import { corsHeaders } from "./cors.ts";

export interface SuccessResponse<T = unknown> { success: true; data?: T; message?: string; }
export interface ErrorResponse { success: false; error: string; code?: string; }

export function successResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(error: string, status = 500, code?: string): Response {
  const body: ErrorResponse = { success: false, error };
  if (code) body.code = code;
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export const Errors = {
  unauthorized: (message = 'Authentication required') => errorResponse(message, 401, 'UNAUTHORIZED'),
  invalidToken: (message = 'Invalid or expired token') => errorResponse(message, 401, 'INVALID_TOKEN'),
  forbidden: (message = 'Access denied') => errorResponse(message, 403, 'FORBIDDEN'),
  adminRequired: (message = 'Admin access required') => errorResponse(message, 403, 'ADMIN_REQUIRED'),
  notFound: (message = 'Resource not found') => errorResponse(message, 404, 'NOT_FOUND'),
  badRequest: (message = 'Invalid request') => errorResponse(message, 400, 'BAD_REQUEST'),
  validationError: (message = 'Invalid input data') => errorResponse(message, 400, 'VALIDATION_ERROR'),
  configError: (message = 'Server configuration error') => errorResponse(message, 500, 'CONFIG_ERROR'),
  serverError: (message = 'An unexpected error occurred') => errorResponse(message, 500, 'SERVER_ERROR'),
  rateLimitExceeded: (message = 'Too many requests. Please try again later.') => errorResponse(message, 429, 'RATE_LIMIT_EXCEEDED'),
};

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return null;
}

export async function parseJsonBody<T>(req: Request, maxSize = 10000): Promise<{ success: true; data: T } | { success: false; response: Response }> {
  const text = await req.text();
  if (text.length > maxSize) return { success: false, response: errorResponse('Request too large', 413, 'PAYLOAD_TOO_LARGE') };
  try {
    return { success: true, data: JSON.parse(text) as T };
  } catch {
    return { success: false, response: Errors.badRequest('Invalid JSON format') };
  }
}
