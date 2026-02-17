import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as cardsService from './cards.service.js';
import { broadcastToBoard } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';
import { logActivity } from '../activities/activities.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const card = await cardsService.createCard(boardId, req.userId!, req.body);
    res.status(201).json({ card });
    broadcastToBoard(boardId, WS_EVENTS.CARD_CREATED, { card }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'card.created', entityType: 'card', entityId: card.id, cardId: card.id, metadata: { title: card.title }, excludeSocketId: req.socketId });
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
    const cardId = req.params.cardId as string;
    const card = await cardsService.updateCard(cardId, req.userId!, req.body);
    res.json({ card });
    broadcastToBoard(boardId, WS_EVENTS.CARD_UPDATED, { card }, req.socketId);

    // Determine specific action
    if (req.body.dueDate !== undefined) {
      const action = req.body.dueDate ? 'dueDate.set' : 'dueDate.cleared';
      logActivity({ boardId, userId: req.userId!, action, entityType: 'card', entityId: cardId, cardId, metadata: { title: card.title, dueDate: req.body.dueDate }, excludeSocketId: req.socketId });
    } else {
      logActivity({ boardId, userId: req.userId!, action: 'card.updated', entityType: 'card', entityId: cardId, cardId, metadata: { title: card.title }, excludeSocketId: req.socketId });
    }
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
    logActivity({ boardId, userId: req.userId!, action: 'card.moved', entityType: 'card', entityId: card.id, cardId: card.id, metadata: { title: card.title, columnId: req.body.columnId }, excludeSocketId: req.socketId });
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
    logActivity({ boardId, userId: req.userId!, action: 'card.archived', entityType: 'card', entityId: cardId, cardId, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}
