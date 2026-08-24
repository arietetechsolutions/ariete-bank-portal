import { getSupabaseUrl, getServiceRoleHeaders } from "./auth-handler.ts";

export type ActionLinkType = 'invite' | 'magiclink' | 'recovery' | 'signup';

export type ActionLinkResult =
  | { success: true; userId?: string; actionLink: string; userMetadata?: Record<string, unknown> }
  | { success: false; status: number; detail: string };

/**
 * Generates a GoTrue action link (invite / magiclink / recovery) for an email.
 *
 * Exists to own ONE detail that was silently wrong at all four call sites
 * (invite-user, bulk-invite, resend-invite, reset-password): the shape of the
 * request body.
 *
 * `POST /auth/v1/admin/generate_link` is the raw REST endpoint, and it takes
 * `redirect_to` and `data` at the TOP LEVEL of the body. Nesting them under
 * `options` is the supabase-js *client* convention
 * (`admin.generateLink({ type, email, options: { redirectTo, data } })`), and
 * that is what every call site here was sending to the REST API instead.
 *
 * GoTrue ignores unknown top-level fields rather than rejecting them, so this
 * failed silently and in two ways at once:
 *   - `redirect_to` was dropped, so every link fell back to the project's
 *     Site URL. Invitees and password-resetters landed on the app root instead
 *     of /set-password, and never saw the form at all.
 *   - `data` was dropped, so contact_name / bank_id never reached
 *     user_metadata. (invite-user happens to also write those to `profiles`
 *     directly, which is why nothing looked broken.)
 *
 * Verified against the live project: the nested shape returns
 * `redirect_to=<site>` and `user_metadata={}`; the top-level shape returns
 * `redirect_to=<site>/set-password` and the metadata intact.
 */
export async function generateActionLink(params: {
  type: ActionLinkType;
  email: string;
  redirectTo: string;
  data?: Record<string, unknown>;
}): Promise<ActionLinkResult> {
  const { type, email, redirectTo, data } = params;

  const response = await fetch(`${getSupabaseUrl()}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: getServiceRoleHeaders(),
    body: JSON.stringify({
      type,
      email,
      // Top level. Not under `options`. See the note above before "tidying".
      redirect_to: redirectTo,
      ...(data ? { data } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`generate_link failed (${type}, ${response.status}):`, errorText);
    let detail = '';
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.msg || parsed.message || '';
    } catch { /* ignore parse error */ }
    return { success: false, status: response.status, detail };
  }

  const body = await response.json();
  return {
    success: true,
    userId: body.id,
    actionLink: body.action_link,
    userMetadata: body.user_metadata,
  };
}
