import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './assignees.service.js';

export async function addHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.addAssignee(
      req.params.boardId as string,
      req.params.cardId as string,
      req.userId!,
      req.body,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.removeAssignee(
      req.params.boardId as string,
      req.params.cardId as string,
      req.userId!,
      req.params.userId as string,
    );
    res.status(204).end();
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
