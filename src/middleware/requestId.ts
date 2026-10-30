import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const reqId = typeof incomingId === 'string' && incomingId.trim().length > 0 ? incomingId.trim() : `req_${uuidv4().replace(/-/g, '')}`;

  req.headers['x-request-id'] = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}
