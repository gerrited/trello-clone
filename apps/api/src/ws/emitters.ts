import { getIO } from './socket.js';

/**
 * Broadcast an event to all clients in a board room except the sender.
 * If no excludeSocketId is provided, broadcasts to all clients in the room.
 */
export function broadcastToBoard(
  boardId: string,
  event: string,
  payload: unknown,
  excludeSocketId?: string,
): void {
  const io = getIO();
  const room = `board:${boardId}`;

  if (excludeSocketId) {
    io.to(room).except(excludeSocketId).emit(event, payload);
  } else {
    io.to(room).emit(event, payload);
  }
}
