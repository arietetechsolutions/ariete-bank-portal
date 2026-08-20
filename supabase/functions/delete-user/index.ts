import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest, createAdminClient } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getAirtableConfig, getTableIds } from "../_shared/airtable-fetcher.ts";
import { logAdminAction } from "../_shared/admin-audit-logger.ts";

const deleteUserSchema = z.object({ userId: z.string().uuid("Invalid user ID") });

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const { user, userEmail } = auth.context;
    const adminAuditTableId = getTableIds().adminAuditLog;
    const airtableConfig = getAirtableConfig();

    const rateLimit = await checkRateLimit(`delete-user:${user.id}`, 10, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<z.infer<typeof deleteUserSchema>>(req);
    if (!body.success) return body.response;

    const validation = deleteUserSchema.safeParse(body.data);
    if (!validation.success) return Errors.badRequest('Invalid input data');

    const { userId } = validation.data;

    if (userId === user.id) {
      return Errors.badRequest('Cannot delete your own account');
    }

    const supabaseAdmin = createAdminClient();

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles').select('email').eq('id', userId).maybeSingle();
    const targetEmail = targetProfile?.email || userId;

    const { error: roleGuardError } = await supabaseAdmin.rpc('guard_and_remove_admin_role', {
      p_target_user_id: userId,
    });

    if (roleGuardError) {
      if (roleGuardError.message.includes('Cannot delete the last admin')) {
        return Errors.badRequest(roleGuardError.message);
      }
      console.error('Error removing user role/profile:', roleGuardError.message);
      return Errors.serverError('Failed to delete user');
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError.message);
      return Errors.serverError('Failed to delete user from authentication');
    }

    logAdminAction(airtableConfig, adminAuditTableId, {
      action: 'DELETE', performedBy: userEmail, targetEmail,
      details: `Deleted user ${targetEmail}`, result: 'SUCCESS',
    });

    return successResponse({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error in delete-user:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while deleting user');
  }
});
