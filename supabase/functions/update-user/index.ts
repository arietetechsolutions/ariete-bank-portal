import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";

interface UpdateUserBody {
  userId: string;
  role?: string;
  bankId?: string;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const body = await parseJsonBody<UpdateUserBody>(req);
    if (!body.success) return body.response;

    const { userId, role, bankId } = body.data;
    if (!userId) return Errors.badRequest('User ID is required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (bankId !== undefined) {
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

    return successResponse({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error in update-user:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while updating user');
  }
});
