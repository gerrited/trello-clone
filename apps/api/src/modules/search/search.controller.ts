import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import type { SearchInput } from '@trello-clone/shared';
import * as service from './search.service.js';

export async function searchHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.searchCards(req.userId!, req.query as unknown as SearchInput);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
