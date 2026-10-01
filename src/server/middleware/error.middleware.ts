/**
 * Central Error Handler Middleware
 * NFR-004: Consistent JSON error format, no stack traces sent to client
 * NFR-003: Usable errors describing what is wrong and how to fix it
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public fields?: Record<string, string>;

  constructor(statusCode: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || 'root';
      if (!fields[path]) {
        fields[path] = issue.message;
      }
    }
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted form contains invalid or missing data. Please review the highlighted fields.',
        fields,
      },
    });
    return;
  }

  // 2. Custom Application Errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  // 3. MySQL Duplicate Entry Error (ER_DUP_ENTRY / 1062)
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    res.status(409).json({
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'A record with this identifier or credential already exists in the system.',
      },
    });
    return;
  }

  // 4. Default Internal Server Error (Never expose stack trace to client, NFR-004)
  console.error('[Unhandled Internal Error]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred while processing your request. Please try again later.',
    },
  });
}
