import { Response } from 'express';
import { FieldError } from './appError.js';

export interface Rfc9457ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId: string;
  timestamp: string;
  errors?: FieldError[];
  retryAfter?: number;
}

export interface ApiResponseEnvelope<T> {
  success: true;
  status: number;
  message: string;
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message: string = 'Operation successful',
    statusCode: number = 200,
    meta?: Record<string, unknown>
  ): Response {
    const requestId = (res.req?.headers['x-request-id'] as string) || 'unknown';
    const body: ApiResponseEnvelope<T> = {
      success: true,
      status: statusCode,
      message,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
    return res.status(statusCode).json(body);
  }

  static created<T>(
    res: Response,
    data: T,
    message: string = 'Resource successfully created',
    meta?: Record<string, unknown>
  ): Response {
    return this.success(res, data, message, 201, meta);
  }

  static accepted<T>(
    res: Response,
    data: T,
    message: string = 'Request accepted for background processing',
    meta?: Record<string, unknown>
  ): Response {
    return this.success(res, data, message, 202, meta);
  }

  static problem(
    res: Response,
    params: {
      type: string;
      title: string;
      status: number;
      detail: string;
      instance: string;
      requestId: string;
      errors?: FieldError[];
      retryAfter?: number;
    }
  ): Response {
    const body: Rfc9457ProblemDetails = {
      type: params.type,
      title: params.title,
      status: params.status,
      detail: params.detail,
      instance: params.instance,
      requestId: params.requestId,
      timestamp: new Date().toISOString(),
      ...(params.errors && params.errors.length > 0 ? { errors: params.errors } : {}),
      ...(params.retryAfter ? { retryAfter: params.retryAfter } : {})
    };

    res.setHeader('Content-Type', 'application/problem+json');
    if (params.retryAfter) {
      res.setHeader('Retry-After', params.retryAfter.toString());
    }
    return res.status(params.status).json(body);
  }
}
