import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as cardsService from './cards.service.js';
import { broadcastToBoard } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const card = await cardsService.createCard(boardId, req.userId!, req.body);
    res.status(201).json({ card });
    broadcastToBoard(boardId, WS_EVENTS.CARD_CREATED, { card }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.getCard(req.params.cardId as string, req.userId!);
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const card = await cardsService.updateCard(req.params.cardId as string, req.userId!, req.body);
    res.json({ card });
    broadcastToBoard(boardId, WS_EVENTS.CARD_UPDATED, { card }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function moveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const card = await cardsService.moveCard(req.params.cardId as string, req.userId!, req.body);
    res.json({ card });
    broadcastToBoard(boardId, WS_EVENTS.CARD_MOVED, { card }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    await cardsService.deleteCard(cardId, req.userId!);
    res.status(204).end();
    broadcastToBoard(boardId, WS_EVENTS.CARD_ARCHIVED, { cardId }, req.socketId);
  } catch (err) {
    next(err);
  }
}
