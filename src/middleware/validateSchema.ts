import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError, FieldError } from '../utils/appError.js';

interface RequestValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validateSchema(schemas: RequestValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: FieldError[] = error.errors.map((err) => {
          const path = err.path.length > 0 ? err.path.join('.') : 'root';
          return {
            field: path,
            message: err.message,
            code: err.code
          };
        });

        next(new ValidationError('Request validation failed. Please check field-level errors.', fieldErrors));
      } else {
        next(error);
      }
    }
  };
}
