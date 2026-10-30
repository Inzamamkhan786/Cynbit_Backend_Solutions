export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly type: string;
  public readonly errors?: FieldError[];
  public readonly retryAfter?: number;

  constructor(
    message: string,
    statusCode: number = 500,
    type: string = 'internal_error',
    errors?: FieldError[],
    retryAfter?: number
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = true;
    this.errors = errors;
    this.retryAfter = retryAfter;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors: FieldError[]) {
    super(message, 400, 'https://api.cynbit.in/errors/validation-error', errors);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, 'https://api.cynbit.in/errors/bad-request');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'https://api.cynbit.in/errors/not-found');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'https://api.cynbit.in/errors/conflict');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, retryAfterSeconds: number) {
    super(
      message,
      429,
      'https://api.cynbit.in/errors/rate-limit-exceeded',
      undefined,
      retryAfterSeconds
    );
  }
}
