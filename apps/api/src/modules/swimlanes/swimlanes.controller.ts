import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as swimlanesService from './swimlanes.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const swimlane = await swimlanesService.createSwimlane(req.params.boardId as string, req.userId!, req.body);
    res.status(201).json({ swimlane });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const swimlane = await swimlanesService.updateSwimlane(req.params.swimlaneId as string, req.userId!, req.body);
    res.json({ swimlane });
  } catch (err) {
    next(err);
  }
}

export async function moveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const swimlane = await swimlanesService.moveSwimlane(req.params.swimlaneId as string, req.userId!, req.body.afterId);
    res.json({ swimlane });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await swimlanesService.deleteSwimlane(req.params.swimlaneId as string, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
