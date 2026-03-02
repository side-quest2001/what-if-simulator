import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Centralised error handler — catches anything thrown in async routes
// when wrapped with `asyncHandler`.

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors → 400 with structured field messages
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Generic errors
  if (err instanceof Error) {
    console.error('[API Error]', err.message);
    res.status(500).json({ error: err.message });
    return;
  }

  console.error('[API Error] Unknown error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

/**
 * Wraps async route handlers so thrown errors reach errorHandler.
 * Express 4 does not natively support async error propagation.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
