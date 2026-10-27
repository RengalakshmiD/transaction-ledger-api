import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/appError';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If it's a known AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle specific PostgreSQL error codes
  if (err.code) {
    // Unique violation (e.g., duplicate reference_id for same account)
    if (err.code === '23505') {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_TRANSACTION',
          message: 'A transaction with this reference_id already exists for this account.',
        },
      });
      return;
    }

    // Foreign key violation (e.g. account_id does not exist)
    if (err.code === '23503') {
      res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'The specified account does not exist.',
        },
      });
      return;
    }

    // Check violation (e.g. balance < 0 or amount <= 0)
    if (err.code === '23514') {
      res.status(422).json({
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Operation violates balance or amount integrity constraints.',
        },
      });
      return;
    }

    // Invalid syntax for UUID
    if (err.code === '22P02') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID_FORMAT',
          message: 'Invalid UUID format provided.',
        },
      });
      return;
    }
  }

  // Unhandled / unexpected internal server error
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred. Please try again later.',
    },
  });
}
