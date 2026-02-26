import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './shares.service.js';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const shares = await service.listShares(req.params.boardId as string, req.userId!);
    res.json({ shares });
  } catch (err) {
    next(err);
  }
}

export async function createUserShareHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const share = await service.createUserShare(req.params.boardId as string, req.userId!, req.body);
    res.status(201).json({ share });
  } catch (err) {
    next(err);
  }
}

export async function createLinkShareHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const share = await service.createLinkShare(req.params.boardId as string, req.userId!, req.body);
    res.status(201).json({ share });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const share = await service.updateShare(
      req.params.boardId as string,
      req.params.shareId as string,
      req.userId!,
      req.body,
    );
    res.json({ share });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.deleteShare(req.params.boardId as string, req.params.shareId as string, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getByTokenHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.getBoardByToken(req.params.token as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
