import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createAdminClient, fetchAllAuthUsers } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const rateLimit = await checkRateLimit(`get-users:${auth.context.user.id}`, 30, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

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
      const authUsers = await fetchAllAuthUsers();
      authUsers.forEach((u) => {
        lastSignInMap.set(u.id, u.last_sign_in_at || null);
        emailConfirmedMap.set(u.id, u.email_confirmed_at || null);
      });
    } catch (authErr) {
      console.error('Error fetching auth users:', authErr instanceof Error ? authErr.message : 'Unknown error');
    }

    const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
    // Admins need to see and manage each other (e.g. removing a stray
    // duplicate invite), just not themselves - self-delete is already
    // blocked server-side, so excluding your own row here is purely to
    // keep the list free of an entry you can't act on anyway.
    const users = (profiles || [])
      .map(profile => ({
        ...profile,
        role: rolesMap.get(profile.id) || 'bank_staff',
        last_sign_in_at: lastSignInMap.get(profile.id) || null,
        email_confirmed_at: emailConfirmedMap.get(profile.id) || null,
      }))
      .filter(profile => profile.id !== auth.context.user.id);

    return successResponse({ users });
  } catch (error) {
    console.error('Error in get-users:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while fetching users');
  }
});
