import type {ContentfulStatusCode} from 'hono/utils/http-status';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
  }
}

export function success(data: unknown = null, message: string | null = null) {
  return {success: true, data, message};
}

export function errorPayload(code: string, message: string, details: unknown = null) {
  return {success: false, data: null, error: {code, message, details}};
}

export function errorResponse(err: AppError): Response {
  return Response.json(errorPayload(err.code, err.message, err.details), {
    status: err.status as ContentfulStatusCode,
  });
}
