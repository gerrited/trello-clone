import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as teamsService from './teams.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const team = await teamsService.createTeam(req.userId!, req.body);
    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const teams = await teamsService.getUserTeams(req.userId!);
    res.json({ teams });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const team = await teamsService.getTeam(req.params.teamId, req.userId!);
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const team = await teamsService.updateTeam(req.params.teamId, req.userId!, req.body);
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await teamsService.deleteTeam(req.params.teamId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function inviteMemberHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const membership = await teamsService.inviteMember(req.params.teamId, req.userId!, req.body);
    res.status(201).json({ membership });
  } catch (err) {
    next(err);
  }
}

export async function removeMemberHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await teamsService.removeMember(req.params.teamId, req.userId!, req.params.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRoleHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const membership = await teamsService.updateMemberRole(
      req.params.teamId,
      req.userId!,
      req.params.userId,
      req.body,
    );
    res.json({ membership });
  } catch (err) {
    next(err);
  }
}
