import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './comments.service.js';
import { broadcastToBoard } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';
import { logActivity } from '../activities/activities.service.js';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const comments = await service.listComments(
      req.params.boardId as string,
      req.params.cardId as string,
      req.userId!,
    );
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const comment = await service.createComment(boardId, cardId, req.userId!, req.body);
    res.status(201).json({ comment });
    broadcastToBoard(boardId, WS_EVENTS.COMMENT_CREATED, { cardId, comment }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'comment.created', entityType: 'comment', entityId: comment.id, cardId, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const comment = await service.updateComment(
      boardId, cardId, req.params.commentId as string, req.userId!, req.body,
    );
    res.json({ comment });
    broadcastToBoard(boardId, WS_EVENTS.COMMENT_UPDATED, { cardId, comment }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const commentId = req.params.commentId as string;
    await service.deleteComment(boardId, cardId, commentId, req.userId!);
    res.status(204).end();
    broadcastToBoard(boardId, WS_EVENTS.COMMENT_DELETED, { cardId, commentId }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'comment.deleted', entityType: 'comment', entityId: commentId, cardId, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}
