import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as cardsService from './cards.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.createCard(req.params.boardId, req.userId!, req.body);
    res.status(201).json({ card });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.getCard(req.params.cardId, req.userId!);
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.updateCard(req.params.cardId, req.userId!, req.body);
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

export async function moveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.moveCard(req.params.cardId, req.userId!, req.body);
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await cardsService.deleteCard(req.params.cardId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
