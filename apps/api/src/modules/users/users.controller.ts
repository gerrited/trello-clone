import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as usersService from './users.service.js';

export async function updateProfileHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await usersService.updateProfile(req.userId!, req.body);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await usersService.changePassword(req.userId!, req.body);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
