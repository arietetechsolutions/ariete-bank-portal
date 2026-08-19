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
  bankId: z.string().trim().min(1).max(100).optional(),
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
      const banksTableId = getTableIds().banks;
      if (airtableConfig && banksTableId) {
        const bankCheck = await fetchRecord(airtableConfig, banksTableId, bankId);
        if (!bankCheck.success) return Errors.badRequest('Invalid bank ID');
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ bank_id: bankId, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile:', profileError.message);
        return Errors.serverError('Failed to update profile');
      }
    }

    if (role) {
      if (role !== 'admin') {
        const { data: currentRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (currentRole?.role === 'admin') {
          const { count: adminCount } = await supabaseAdmin
            .from('user_roles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'admin');

          if ((adminCount ?? 0) <= 1) {
            return Errors.badRequest('Cannot remove the last admin. Promote another user to admin first.');
          }
        }
      }

      const { error: deleteRoleError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteRoleError) {
        console.error('Error deleting old role:', deleteRoleError.message);
      }

      const { error: insertRoleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (insertRoleError) {
        console.error('Error inserting new role:', insertRoleError.message);
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
