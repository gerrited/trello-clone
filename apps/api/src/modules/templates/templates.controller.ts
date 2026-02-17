import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './templates.service.js';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const templates = await service.listTemplates(req.params.teamId as string, req.userId!);
    res.json({ templates });
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const template = await service.createTemplate(
      req.params.teamId as string,
      req.userId!,
      req.body,
    );
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const template = await service.updateTemplate(
      req.params.teamId as string,
      req.params.templateId as string,
      req.userId!,
      req.body,
    );
    res.json({ template });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.deleteTemplate(
      req.params.teamId as string,
      req.params.templateId as string,
      req.userId!,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function createFromTemplateHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const board = await service.createBoardFromTemplate(
      req.params.teamId as string,
      req.userId!,
      req.body,
    );
    res.status(201).json({ board });
  } catch (err) {
    next(err);
  }
}

export async function saveAsTemplateHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const template = await service.saveAsTemplate(
      req.params.boardId as string,
      req.userId!,
      req.body,
    );
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
}
