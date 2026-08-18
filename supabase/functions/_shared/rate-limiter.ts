import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitResult { allowed: boolean; remaining: number; retryAfterSeconds: number; }

export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<RateLimitResult> {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: key, p_max_requests: maxRequests, p_window_seconds: windowSeconds,
  });

  if (error || !data || data.length === 0) {
    console.error('Rate limit check failed:', error?.message ?? 'No data returned');
    return { allowed: true, remaining: maxRequests, retryAfterSeconds: 0 };
  }

  const row = data[0];
  const windowEndMs = new Date(row.window_start).getTime() + windowSeconds * 1000;
  return {
    allowed: row.allowed,
    remaining: Math.max(0, maxRequests - row.request_count),
    retryAfterSeconds: row.allowed ? 0 : Math.ceil((windowEndMs - Date.now()) / 1000),
  };
}
