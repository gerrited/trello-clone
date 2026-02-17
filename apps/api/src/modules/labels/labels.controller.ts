import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './labels.service.js';
import { broadcastToBoard } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';
import { logActivity } from '../activities/activities.service.js';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const labels = await service.listLabels(req.params.boardId as string, req.userId!);
    res.json({ labels });
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const label = await service.createLabel(boardId, req.userId!, req.body);
    res.status(201).json({ label });
    broadcastToBoard(boardId, WS_EVENTS.LABEL_CREATED, { label }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const labelId = req.params.labelId as string;
    const label = await service.updateLabel(boardId, labelId, req.userId!, req.body);
    res.json({ label });
    broadcastToBoard(boardId, WS_EVENTS.LABEL_UPDATED, { label }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const labelId = req.params.labelId as string;
    await service.deleteLabel(boardId, labelId, req.userId!);
    res.status(204).end();
    broadcastToBoard(boardId, WS_EVENTS.LABEL_DELETED, { labelId }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function addCardLabelHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const result = await service.addCardLabel(boardId, cardId, req.userId!, req.body.labelId);
    res.status(201).json(result);
    broadcastToBoard(boardId, WS_EVENTS.CARD_LABEL_ADDED, { cardId, ...result }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'label.added', entityType: 'card', entityId: cardId, cardId, metadata: { labelName: result.label?.name }, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}

export async function removeCardLabelHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const labelId = req.params.labelId as string;
    await service.removeCardLabel(boardId, cardId, req.userId!, labelId);
    res.status(204).end();
    broadcastToBoard(boardId, WS_EVENTS.CARD_LABEL_REMOVED, { cardId, labelId }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'label.removed', entityType: 'card', entityId: cardId, cardId, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}
