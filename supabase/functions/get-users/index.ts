import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createAdminClient } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors } from "../_shared/response-formatter.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    // RLS on profiles/user_roles only allows a user to see their own row, so
    // we need the service-role client here to see every bank-staff account.
    const supabase = createAdminClient();

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: false });
    if (profilesError) return Errors.serverError('Failed to fetch users');

    const { data: roles } = await supabase.from('user_roles').select('user_id, role');

    const lastSignInMap = new Map<string, string | null>();
    const emailConfirmedMap = new Map<string, string | null>();
    try {
      const authResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users?per_page=1000`, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        },
      });
      if (authResponse.ok) {
        const authData = await authResponse.json();
        const authUsers = authData.users || authData;
        if (Array.isArray(authUsers)) {
          authUsers.forEach((u: { id: string; last_sign_in_at?: string | null; email_confirmed_at?: string | null }) => {
            lastSignInMap.set(u.id, u.last_sign_in_at || null);
            emailConfirmedMap.set(u.id, u.email_confirmed_at || null);
          });
        }
      }
    } catch (authErr) {
      console.error('Error fetching auth users:', authErr instanceof Error ? authErr.message : 'Unknown error');
    }

    const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
    // This screen manages bank-staff accounts only - admins (including the
    // caller themselves) never belong in this list.
    const users = (profiles || [])
      .map(profile => ({
        ...profile,
        role: rolesMap.get(profile.id) || 'bank_staff',
        last_sign_in_at: lastSignInMap.get(profile.id) || null,
        email_confirmed_at: emailConfirmedMap.get(profile.id) || null,
      }))
      .filter(profile => profile.role !== 'admin');

    return successResponse({ users });
  } catch (error) {
    console.error('Error in get-users:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while fetching users');
  }
});
