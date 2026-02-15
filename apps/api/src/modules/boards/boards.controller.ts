import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as boardsService from './boards.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const board = await boardsService.createBoard(req.params.teamId, req.userId!, req.body);
    res.status(201).json({ board });
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boards = await boardsService.listBoards(req.params.teamId, req.userId!);
    res.json({ boards });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const board = await boardsService.getBoard(req.params.boardId, req.userId!);
    res.json({ board });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const board = await boardsService.updateBoard(req.params.boardId, req.userId!, req.body);
    res.json({ board });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await boardsService.deleteBoard(req.params.boardId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
