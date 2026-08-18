const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN');
if (!ALLOWED_ORIGIN) {
  throw new Error('ALLOWED_ORIGIN environment variable is required');
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return null;
}
