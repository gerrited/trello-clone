import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as columnsService from './columns.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const column = await columnsService.createColumn(req.params.boardId, req.userId!, req.body);
    res.status(201).json({ column });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const column = await columnsService.updateColumn(req.params.columnId, req.userId!, req.body);
    res.json({ column });
  } catch (err) {
    next(err);
  }
}

export async function moveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const column = await columnsService.moveColumn(req.params.columnId, req.userId!, req.body.afterId);
    res.json({ column });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await columnsService.deleteColumn(req.params.columnId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
