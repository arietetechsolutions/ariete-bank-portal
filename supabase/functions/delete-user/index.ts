import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createAdminClient } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getAirtableConfig, getTableIds } from "../_shared/airtable-fetcher.ts";
import { logAdminAction } from "../_shared/admin-audit-logger.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const { supabase, user, userEmail } = auth.context;
    const adminAuditTableId = getTableIds().adminAuditLog;
    const airtableConfig = getAirtableConfig();

    const rateLimit = await checkRateLimit(`delete-user:${user.id}`, 10, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<{ userId: string }>(req);
    if (!body.success) return body.response;

    const { userId } = body.data;
    if (!userId) return Errors.badRequest('User ID is required');

    if (userId === user.id) {
      return Errors.badRequest('Cannot delete your own account');
    }

    const supabaseAdmin = createAdminClient();

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles').select('email').eq('id', userId).maybeSingle();
    const targetEmail = targetProfile?.email || userId;

    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (targetRole?.role === 'admin') {
      const { count: adminCount } = await supabaseAdmin
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');

      if ((adminCount ?? 0) <= 1) {
        return Errors.badRequest('Cannot delete the last admin. Promote another user to admin first.');
      }
    }

    const { error: roleDeleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (roleDeleteError) {
      console.error('Error deleting user role:', roleDeleteError.message);
    }

    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.error('Error deleting profile:', profileDeleteError.message);
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
