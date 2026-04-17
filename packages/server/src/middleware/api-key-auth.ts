import type { Request, Response, NextFunction } from 'express';
import { verifyApiKey } from '../db';

declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      apiKeyScopes?: string[];
    }
  }
}

export function requireApiKey(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer zk_live_')) {
      res.status(401).json({ error: 'ERROR_API_KEY_REQUIRED' });
      return;
    }
    const rawKey = header.slice(7);
    const record = verifyApiKey(rawKey, scope);
    if (!record) {
      res.status(403).json({ error: 'ERROR_API_KEY_INVALID_OR_INSUFFICIENT_SCOPE' });
      return;
    }
    req.apiKeyId = record.id;
    req.apiKeyScopes = record.scopes;
    next();
  };
}
