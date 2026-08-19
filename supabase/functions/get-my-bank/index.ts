import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors } from "../_shared/response-formatter.ts";
import { getAirtableConfig, getTableIds, fetchRecord } from "../_shared/airtable-fetcher.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

// Scoped counterpart to get-banks: returns only the caller's own bank (via
// their server-verified profile.bank_id), never the full cross-bank
// directory. This is what the header's "which bank am I" display should
// use instead of fetching every bank and filtering client-side.
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req);
    if (!auth.success) return auth.response;

    const { user, profile, isAdmin } = auth.context;

    const rateLimit = await checkRateLimit(`get-my-bank:${user.id}`, 60, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    if (isAdmin || !profile?.bank_id) {
      return successResponse({ bank: null });
    }

    const airtableConfig = getAirtableConfig();
    if (!airtableConfig) return Errors.configError();

    const tableIds = getTableIds();
    if (!tableIds.banks) return Errors.configError('Banks table not configured');

    const result = await fetchRecord(airtableConfig, tableIds.banks, profile.bank_id);
    if (!result.success) return successResponse({ bank: null });

    const name = (result.record.fields['bank'] as string) || null;
    return successResponse({ bank: name ? { id: result.record.id, name } : null });
  } catch (error) {
    console.error('Error in get-my-bank:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while fetching your bank');
  }
});
