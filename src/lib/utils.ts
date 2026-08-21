import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// supabase-js's FunctionsHttpError.message is always the hardcoded string
// "Edge Function returned a non-2xx status code" - the actual { error }
// body our edge functions send (rate limit reasons, "cannot delete the
// last admin", "email already has an account", etc.) only lives on
// error.context, an unread Response. Every call site was throwing
// error.message directly and showing that generic text to the user instead.
export async function getFunctionErrorMessage(error: unknown, fallback = 'Something went wrong'): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body && typeof body.error === 'string') return body.error;
      } catch {
        // Body wasn't JSON - fall through to the generic message below.
      }
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
