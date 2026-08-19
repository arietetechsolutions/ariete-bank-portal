import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest, createAdminClient } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getAirtableConfig, getTableIds, fetchRecord } from "../_shared/airtable-fetcher.ts";
import { logAdminAction } from "../_shared/admin-audit-logger.ts";

const updateUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  role: z.enum(['admin', 'bank_staff']).optional(),
  // Empty string means "clear the bank assignment" - the edit-user dialog
  // always sends bank_id (falling back to '' when it's currently unset), so
  // this can't require min(1) the way invite/bulk-invite's bankId can.
  bankId: z.string().trim().max(100).optional(),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const { userEmail } = auth.context;
    const adminAuditTableId = getTableIds().adminAuditLog;
    const airtableConfig = getAirtableConfig();

    const rateLimit = await checkRateLimit(`update-user:${auth.context.user.id}`, 20, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<z.infer<typeof updateUserSchema>>(req);
    if (!body.success) return body.response;

    const validation = updateUserSchema.safeParse(body.data);
    if (!validation.success) return Errors.badRequest('Invalid input data');

    const { userId, role, bankId } = validation.data;

    const supabaseAdmin = createAdminClient();

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles').select('email').eq('id', userId).maybeSingle();
    const targetEmail = targetProfile?.email || userId;

    if (bankId !== undefined) {
      const normalizedBankId = bankId === '' ? null : bankId;

      if (normalizedBankId !== null) {
        const banksTableId = getTableIds().banks;
        if (!airtableConfig || !banksTableId) return Errors.configError('Banks table not configured');
        const bankCheck = await fetchRecord(airtableConfig, banksTableId, normalizedBankId);
        if (!bankCheck.success) return Errors.badRequest('Invalid bank ID');
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ bank_id: normalizedBankId, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile:', profileError.message);
        return Errors.serverError('Failed to update profile');
      }
    }

    if (role) {
      const { error: roleGuardError } = await supabaseAdmin.rpc('guard_and_swap_role', {
        p_target_user_id: userId,
        p_new_role: role,
      });

      if (roleGuardError) {
        if (roleGuardError.message.includes('Cannot remove the last admin')) {
          return Errors.badRequest(roleGuardError.message);
        }
        console.error('Error updating role:', roleGuardError.message);
        return Errors.serverError('Failed to update role');
      }
    }

    logAdminAction(airtableConfig, adminAuditTableId, {
      action: 'UPDATE', performedBy: userEmail, targetEmail,
      details: `Updated user ${targetEmail}${bankId !== undefined ? ` (bank_id: ${bankId})` : ''}${role ? ` (role: ${role})` : ''}`,
      result: 'SUCCESS',
    });

    return successResponse({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error in update-user:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while updating user');
  }
});
