import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const { supabase, user } = auth.context;

    const rateLimit = await checkRateLimit(`delete-user:${user.id}`, 10, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<{ userId: string }>(req);
    if (!body.success) return body.response;

    const { userId } = body.data;
    if (!userId) return Errors.badRequest('User ID is required');

    if (userId === user.id) {
      return Errors.badRequest('Cannot delete your own account');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    return successResponse({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error in delete-user:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while deleting user');
  }
});
