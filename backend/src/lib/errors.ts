export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;
  expose: boolean;

  constructor(options: {
    message: string;
    statusCode: number;
    code: string;
    details?: Record<string, unknown>;
    expose?: boolean;
  }) {
    super(options.message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? options.statusCode < 500;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ message, details, statusCode: 400, code: 'VALIDATION_ERROR' });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Not authenticated') {
    super({ message, statusCode: 401, code: 'AUTHENTICATION_ERROR' });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super({ message, statusCode: 403, code: 'AUTHORIZATION_ERROR' });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ message, details, statusCode: 409, code: 'CONFLICT_ERROR' });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super({ message, statusCode: 404, code: 'NOT_FOUND' });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super({ message, statusCode: 429, code: 'RATE_LIMITED' });
  }
}

export class ExternalProviderError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      details,
      statusCode: 502,
      code: 'EXTERNAL_PROVIDER_ERROR',
      expose: false,
    });
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error') {
    super({
      message,
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      expose: false,
    });
  }
}

export function toAppError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error && 'status' in error) {
    const statusCode =
      typeof (error as { status?: unknown }).status === 'number'
        ? ((error as { status: number }).status ?? 500)
        : 500;
    return new AppError({
      message: error.message,
      statusCode,
      code: statusCode >= 500 ? 'HTTP_ERROR' : 'REQUEST_ERROR',
      expose: statusCode < 500,
    });
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message);
  }

  return new InternalServerError();
}
