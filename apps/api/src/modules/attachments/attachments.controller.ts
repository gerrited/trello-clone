import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './attachments.service.js';
import { broadcastToBoard } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';
import { logActivity } from '../activities/activities.service.js';
import { AppError } from '../../middleware/error.js';

export async function uploadHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const attachment = await service.addAttachment(boardId, cardId, req.userId!, req.file);
    res.status(201).json({ attachment });
    broadcastToBoard(boardId, WS_EVENTS.ATTACHMENT_ADDED, { cardId, attachment }, req.socketId);
    logActivity({
      boardId,
      userId: req.userId!,
      action: 'card.updated',
      entityType: 'attachment',
      entityId: attachment.id,
      cardId,
      metadata: { filename: attachment.filename },
      excludeSocketId: req.socketId,
    });
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const attachments = await service.listAttachments(
      req.params.boardId as string,
      req.params.cardId as string,
      req.userId!,
    );
    res.json({ attachments });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const attachmentId = req.params.attachmentId as string;
    await service.deleteAttachment(boardId, cardId, attachmentId, req.userId!);
    res.status(204).end();
    broadcastToBoard(boardId, WS_EVENTS.ATTACHMENT_REMOVED, { cardId, attachmentId }, req.socketId);
    logActivity({
      boardId,
      userId: req.userId!,
      action: 'card.updated',
      entityType: 'attachment',
      entityId: attachmentId,
      cardId,
      excludeSocketId: req.socketId,
    });
  } catch (err) {
    next(err);
  }
}
