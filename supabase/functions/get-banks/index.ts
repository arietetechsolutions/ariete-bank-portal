import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors } from "../_shared/response-formatter.ts";
import { getAirtableConfig, getTableIds, fetchAllRecords } from "../_shared/airtable-fetcher.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req);
    if (!auth.success) return auth.response;

    const airtableConfig = getAirtableConfig();
    if (!airtableConfig) return Errors.configError();

    const tableIds = getTableIds();
    if (!tableIds.banks) return Errors.configError('Banks table not configured');

    const result = await fetchAllRecords(airtableConfig, tableIds.banks);
    if (!result.success) return Errors.serverError(result.error);

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
