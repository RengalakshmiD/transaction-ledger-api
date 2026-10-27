export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request data', details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Transaction with this reference ID already exists for this account', code = 'DUPLICATE_TRANSACTION') {
    super(409, code, message);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message = 'Insufficient account balance for this transaction', code = 'INSUFFICIENT_BALANCE') {
    super(422, code, message);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(400, code, message);
  }
}
