import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import { checkRateLimit } from "./rate-limiter.ts";

export interface AuthContext {
  user: User;
  userEmail: string;
  supabase: SupabaseClient;
  isAdmin: boolean;
  profile?: {
    bank_id: string | null;
    contact_name: string | null;
  };
}

export interface AuthOptions {
  requireAdmin?: boolean;
  requireBankId?: boolean;
}

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; response: Response };

export async function authenticateRequest(req: Request, options: AuthOptions = {}): Promise<AuthResult> {
  const { requireAdmin = false, requireBankId = false } = options;

  // checkRateLimit keys on user.id, which doesn't exist yet for an
  // unauthenticated or bad-token request - without a check here, a flood of
  // garbage-token requests has no rate limit at all and each one still costs
  // a full round trip to the Auth server via getUser() below.
  //
  // This is deliberately a single global counter, not keyed by client IP:
  // x-forwarded-for is attacker-controlled and nothing in front of this
  // function currently normalizes it, so keying on it would let an attacker
  // forge a real bank's IP and exhaust that specific bank's bucket - a
  // targeted lockout, which is worse than the flood this is meant to catch.
  // Revisit with a trusted-hop-aware IP key once the production reverse-proxy
  // topology is finalized (still undecided as of this app's initial build).
  const preAuthRateLimit = await checkRateLimit('auth-pre-auth-global', 600, 60);
  if (!preAuthRateLimit.allowed) {
    return { success: false, response: new Response(JSON.stringify({ success: false, error: 'Too many requests' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { success: false, response: new Response(JSON.stringify({ success: false, error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, response: new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  const userEmail = user.email || 'unknown';

  const { data: adminRole } = await supabase
    .from('user_roles').select('id').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  const isAdmin = !!adminRole;

  if (requireAdmin && !isAdmin) {
    return { success: false, response: new Response(JSON.stringify({ success: false, error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  const { data: profileData } = await supabase
    .from('profiles').select('bank_id, contact_name').eq('id', user.id).single();

  const profile: AuthContext['profile'] = profileData ? {
    bank_id: profileData.bank_id,
    contact_name: profileData.contact_name,
  } : undefined;

  if (requireBankId && !profile?.bank_id && !isAdmin) {
    return { success: false, response: new Response(JSON.stringify({ success: false, error: 'Your profile does not have a bank assigned. Please contact an administrator.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  return { success: true, context: { user, userEmail, supabase, isAdmin, profile } };
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function getSupabaseUrl(): string {
  return Deno.env.get('SUPABASE_URL')!;
}

// For the functions that call Supabase's admin REST endpoints directly via
// fetch (generate_link, invite, admin/users) instead of the supabase-js
// client - was previously copy-pasted verbatim in three separate functions.
export function getServiceRoleHeaders(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' };
}

export interface AuthUserSummary {
  id: string;
  email?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}

// GoTrue's admin/users endpoint paginates (max page size 1000) - a single
// `per_page=1000` request silently only returns the first page. That was
// invisible below ~1000 total users, but would have made get-users drop
// enrichment data for later users and made bulk-invite treat already-invited
// users past the first page as brand new (re-inviting them instead of
// updating their existing profile) the moment the user base grew past it.
export async function fetchAllAuthUsers(): Promise<AuthUserSummary[]> {
  const all: AuthUserSummary[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const response = await fetch(
      `${getSupabaseUrl()}/auth/v1/admin/users?per_page=${perPage}&page=${page}`,
      { headers: getServiceRoleHeaders() },
    );
    if (!response.ok) {
      console.error(`fetchAllAuthUsers: admin/users page ${page} returned ${response.status}`);
      break;
    }
    const data = await response.json();
    const users = (data.users || data) as AuthUserSummary[];
    if (!Array.isArray(users) || users.length === 0) break;

    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }

  return all;
}
