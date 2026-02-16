import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './assignees.service.js';
import { broadcastToBoard } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';

export async function addHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const result = await service.addAssignee(boardId, cardId, req.userId!, req.body);
    res.status(201).json(result);
    broadcastToBoard(boardId, WS_EVENTS.ASSIGNEE_ADDED, { cardId, ...result }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function removeHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const userId = req.params.userId as string;
    await service.removeAssignee(boardId, cardId, req.userId!, userId);
    res.status(204).end();
    broadcastToBoard(boardId, WS_EVENTS.ASSIGNEE_REMOVED, { cardId, userId }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const assignees = await service.listAssignees(
      req.params.boardId as string,
      req.params.cardId as string,
      req.userId!,
    );
    res.json({ assignees });
  } catch (err) {
    next(err);
  }
}
