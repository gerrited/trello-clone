import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './comments.service.js';

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
    const comment = await service.createComment(
      req.params.boardId as string,
      req.params.cardId as string,
      req.userId!,
      req.body,
    );
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const comment = await service.updateComment(
      req.params.boardId as string,
      req.params.cardId as string,
      req.params.commentId as string,
      req.userId!,
      req.body,
    );
    res.json({ comment });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.deleteComment(
      req.params.boardId as string,
      req.params.cardId as string,
      req.params.commentId as string,
      req.userId!,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
