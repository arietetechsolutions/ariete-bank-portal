import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { getAirtableConfig, getTableIds, fetchRecord, updateRecord, createRecord } from "../_shared/airtable-fetcher.ts";

const updateSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account ID is required"),
  newStatus: z.enum([
    'Onboarding',
    'Account Opened',
    'Waiting for transfer',
    'Transfer made - waiting for AML letter',
    'AML Letter Issued',
  ]),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireBankId: true });
    if (!auth.success) return auth.response;

    const { userEmail, profile, isAdmin } = auth.context;
    const userBankId = profile?.bank_id || null;

    if (!isAdmin && !userBankId) {
      return Errors.forbidden('Your profile does not have a bank assigned.');
    }

    const body = await parseJsonBody<z.infer<typeof updateSchema>>(req);
    if (!body.success) return body.response;

    const result = updateSchema.safeParse(body.data);
    if (!result.success) return Errors.badRequest('Invalid input data');

    const { bankAccountId, newStatus } = result.data;

    const airtableConfig = getAirtableConfig();
    if (!airtableConfig) return Errors.configError();

    const tableIds = getTableIds();
    if (!tableIds.bankAccounts || !tableIds.auditLog) return Errors.configError('Bank Accounts/Audit Log tables not configured');

    const fetchResult = await fetchRecord(airtableConfig, tableIds.bankAccounts, bankAccountId);
    if (!fetchResult.success) return Errors.notFound('Bank account not found');

    const bankAccount = fetchResult.record;
    const recordBankIds = (bankAccount.fields['Bank'] as string[]) || [];

    if (!isAdmin && (!userBankId || !recordBankIds.includes(userBankId))) {
      return Errors.forbidden('You do not have permission to update this account');
    }

    const oldStatus = (bankAccount.fields['Bank account status'] as string) || '';

    const updateResult = await updateRecord(airtableConfig, tableIds.bankAccounts, bankAccountId, {
      'Bank account status': newStatus,
    });
    if (!updateResult.success) return Errors.serverError('Failed to update status');

    // Non-blocking audit log write
    createRecord(airtableConfig, tableIds.auditLog, {
      bank_account: [bankAccountId],
      changed_by: userEmail,
      old_status: oldStatus,
      new_status: newStatus,
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error('Failed to write audit log:', err));

    return successResponse({ message: 'Status updated successfully', bankAccountId });
  } catch (error) {
    console.error('Error in update-bank-account-status:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while updating status');
  }
});
