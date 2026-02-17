import { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { WS_EVENTS } from '@trello-clone/shared';
import { pino } from 'pino';

const logger = pino({ name: 'ws' });

let io: Server | null = null;

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function setupSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.WEB_URL,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Authenticate sockets via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info({ userId, socketId: socket.id }, 'Client connected');

    // Join user-specific room for notifications
    socket.join(`user:${userId}`);

    // Join a board room
    socket.on(WS_EVENTS.BOARD_JOIN, (boardId: string) => {
      if (typeof boardId !== 'string' || !boardId) return;
      // Leave all other board rooms first
      for (const room of socket.rooms) {
        if (room.startsWith('board:')) {
          socket.leave(room);
        }
      }
      const roomName = `board:${boardId}`;
      socket.join(roomName);
      logger.info({ userId, boardId, socketId: socket.id }, 'Joined board room');
    });

    // Leave a board room
    socket.on(WS_EVENTS.BOARD_LEAVE, (boardId: string) => {
      if (typeof boardId !== 'string' || !boardId) return;
      socket.leave(`board:${boardId}`);
      logger.info({ userId, boardId, socketId: socket.id }, 'Left board room');
    });

    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason }, 'Client disconnected');
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}
