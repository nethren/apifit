export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function fail(code, message, status) { throw new AppError(code, message, status); }
export function publicError(error) {
  if (error instanceof AppError) return { status: error.status, code: error.code, message: error.message };
  return { status: 500, code: 'INTERNAL_ERROR', message: 'The request could not be completed. No assessment was fabricated.' };
}
