import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { getAirtableConfig, getTableIds, fetchRecord, updateRecord, createRecord, AIRTABLE_RECORD_ID_REGEX } from "../_shared/airtable-fetcher.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { backgroundTask } from "../_shared/admin-audit-logger.ts";

const updateSchema = z.object({
  // Any authenticated bank_staff can call this (not just admins), so this
  // is the highest-exposure record-ID input in the app - unvalidated, it
  // would have let a client-controlled string reach fetchRecord/updateRecord
  // unescaped.
  bankAccountId: z.string().trim().regex(AIRTABLE_RECORD_ID_REGEX, "Invalid bank account ID"),
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

    const { user, userEmail, profile, isAdmin } = auth.context;
    const userBankId = profile?.bank_id || null;

    if (!isAdmin && !userBankId) {
      return Errors.forbidden('Your profile does not have a bank assigned.');
    }

    const rateLimit = await checkRateLimit(`update-bank-account-status:${user.id}`, 30, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<z.infer<typeof updateSchema>>(req);
    if (!body.success) return body.response;

    const result = updateSchema.safeParse(body.data);
    if (!result.success) return Errors.badRequest('Invalid input data');

    const { bankAccountId, newStatus } = result.data;

    const airtableConfig = getAirtableConfig();
    if (!airtableConfig) return Errors.configError();

    const tableIds = getTableIds();
    if (!tableIds.bankAccounts || !tableIds.auditLog) return Errors.configError('Bank Accounts/Audit Log tables not configured');

    // Accepted risk, documented rather than "fixed": this fetch-then-check-
    // then-write is not transactional, so a client's Bank link could in
    // theory be reassigned by an admin in the moment between the check below
    // and updateRecord() further down. Airtable's REST API has no
    // compare-and-swap / row-locking primitive to close that window, and the
    // blast radius is narrow even if it's hit - the write only ever touches
    // this one record's status field, never its bank linkage, so the worst
    // case is a single stray status value, not cross-bank data exposure.
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

    // Non-blocking audit log write. This is the AML-status-change trail, so
    // it gets the same EdgeRuntime.waitUntil treatment as the admin-action
    // audit log: without it, the edge runtime can tear down the isolate
    // right after the response above is sent, killing this write - or even
    // its own .catch() - before either runs, leaving the status change with
    // no recorded trail and no visible failure anywhere.
    backgroundTask(
      createRecord(airtableConfig, tableIds.auditLog, {
        bank_account: [bankAccountId],
        changed_by: userEmail,
        old_status: oldStatus,
        new_status: newStatus,
        timestamp: new Date().toISOString(),
      }).then((result) => {
        if (!result.success) console.error('Failed to write audit log:', result.error);
      }).catch((err) => console.error('Failed to write audit log:', err))
    );

    return successResponse({ message: 'Status updated successfully', bankAccountId });
  } catch (error) {
    console.error('Error in update-bank-account-status:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while updating status');
  }
});
