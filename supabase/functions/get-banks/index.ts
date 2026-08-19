import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors } from "../_shared/response-formatter.ts";
import { getAirtableConfig, getTableIds, fetchAllRecords } from "../_shared/airtable-fetcher.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Admin-only: the full cross-bank directory (every partner bank's name
    // and internal record id) has no business being visible to a bank_staff
    // user - that's exactly the boundary the rest of this app enforces
    // elsewhere. Non-admins get their own bank via get-my-bank instead.
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const rateLimit = await checkRateLimit(`get-banks:${auth.context.user.id}`, 60, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const airtableConfig = getAirtableConfig();
    if (!airtableConfig) return Errors.configError();

    const tableIds = getTableIds();
    if (!tableIds.banks) return Errors.configError('Banks table not configured');

    const result = await fetchAllRecords(airtableConfig, tableIds.banks);
    if (!result.success) {
      console.error('Error in get-banks:', result.error);
      return Errors.serverError('Failed to fetch banks');
    }

    const banks = result.records
      .map(record => ({ id: record.id, name: (record.fields['bank'] as string) || record.id }))
      .filter(bank => bank.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse({ banks });
  } catch (error) {
    console.error('Error in get-banks:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while fetching banks');
  }
});
