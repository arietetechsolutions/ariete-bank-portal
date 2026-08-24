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

// Whole calendar days between an Airtable date and today.
//
// Both sides are normalised to UTC midnight before subtracting: Airtable
// date-only fields arrive as "YYYY-MM-DD", which `new Date()` parses as UTC
// midnight, while the viewer's "today" is local. Mixing the two makes the
// count drift by a day either side of midnight depending on the timezone the
// browser happens to be in. Comparing calendar dates in a single frame of
// reference keeps every viewer on the same integer.
//
// Returns null for a missing, unparseable, or future date - a status cannot
// have changed tomorrow, so that is bad data rather than a negative count to
// render.
export function daysSince(dateString: string | null | undefined): number | null {
  if (!dateString) return null;

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;

  const then = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const days = Math.round((today - then) / 86_400_000);
  return days < 0 ? null : days;
}

// "Today" / "1 day" / "12 days" - the em dash is the shared table placeholder
// for "Airtable has no date for this record".
export function formatDaysSince(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'Today';
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
