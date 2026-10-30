import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/appError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const reqId = (req.headers['x-request-id'] as string) || 'unknown';
  const instance = req.originalUrl || req.url;

  // Handle JSON SyntaxError from express.json()
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    logger.warn('Malformed JSON payload received', { requestId: reqId, instance });
    ApiResponse.problem(res, {
      type: 'https://api.cynbit.in/errors/malformed-json',
      title: 'Invalid JSON Payload',
      status: 400,
      detail: 'The request body contains malformed JSON that could not be parsed.',
      instance,
      requestId: reqId
    });
    return;
  }

  // Handle custom AppErrors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`AppError [${err.statusCode}]: ${err.message}`, { requestId: reqId, instance }, err);
    } else {
      logger.warn(`AppError [${err.statusCode}]: ${err.message}`, { requestId: reqId, instance });
    }

    ApiResponse.problem(res, {
      type: err.type,
      title: err.name.replace(/([A-Z])/g, ' $1').trim(),
      status: err.statusCode,
      detail: err.message,
      instance,
      requestId: reqId,
      errors: err.errors,
      retryAfter: err.retryAfter
    });
    return;
  }

  // Unhandled / Unexpected Errors (500)
  logger.error('Unhandled Server Exception', { requestId: reqId, instance }, err);

  const detail =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred. Please contact support with the requestId.'
      : err.message || 'Internal server error';

  ApiResponse.problem(res, {
    type: 'https://api.cynbit.in/errors/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail,
    instance,
    requestId: reqId
  });
}
