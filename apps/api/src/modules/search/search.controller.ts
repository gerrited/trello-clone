import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './search.service.js';

export async function searchHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await service.searchCards(req.userId!, req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
