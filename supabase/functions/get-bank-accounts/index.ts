import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors } from "../_shared/response-formatter.ts";
import { getAirtableConfig, getTableIds, fetchAllRecords } from "../_shared/airtable-fetcher.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireBankId: true });
    if (!auth.success) return auth.response;

    const { profile, isAdmin } = auth.context;
    const userBankId = profile?.bank_id;

    if (!isAdmin && !userBankId) {
      return Errors.forbidden('Your profile does not have a bank assigned. Please contact an administrator.');
    }

    const airtableConfig = getAirtableConfig();
    if (!airtableConfig) return Errors.configError();

    const tableIds = getTableIds();
    if (!tableIds.bankAccounts) return Errors.configError('Bank Accounts table not configured');

    const result = await fetchAllRecords(airtableConfig, tableIds.bankAccounts);
    if (!result.success) return Errors.serverError('Failed to fetch bank accounts');

    const bankAccounts = result.records.map((record) => {
      const fields = record.fields;
      const bankLinks = (fields['Bank'] as string[]) || [];
      const emailField = fields['Email'];
      const email = Array.isArray(emailField) ? (emailField[0] as string) || '' : (emailField as string) || '';
      return {
        id: record.id,
        client_name: (fields['Client'] as string) || '',
        email,
        status: (fields['Bank account status'] as string) || '',
        created_at: record.createdTime,
        bank_ids: bankLinks,
      };
    });

    const filtered = bankAccounts
      .filter((acc) => userBankId ? acc.bank_ids.includes(userBankId) : false)
      .map(({ bank_ids, ...rest }) => rest);

    return successResponse({ bankAccounts: filtered });
  } catch (error) {
    console.error('Error in get-bank-accounts:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while fetching bank accounts');
  }
});
