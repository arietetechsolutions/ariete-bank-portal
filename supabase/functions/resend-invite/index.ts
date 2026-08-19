import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getAirtableConfig, getTableIds } from "../_shared/airtable-fetcher.ts";
import { logAdminAction } from "../_shared/admin-audit-logger.ts";

interface ResendInviteBody {
  userId: string;
}

const getSupabaseUrl = () => Deno.env.get('SUPABASE_URL')!;
const getServiceRoleKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminHeaders = () => ({
  'Authorization': `Bearer ${getServiceRoleKey()}`,
  'apikey': getServiceRoleKey(),
  'Content-Type': 'application/json',
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const { user, userEmail } = auth.context;
    const adminAuditTableId = getTableIds().adminAuditLog;
    const airtableConfig = getAirtableConfig();

    const rateLimit = await checkRateLimit(`resend-invite:${user.id}`, 5, 60);
    if (!rateLimit.allowed) {
      return Errors.rateLimitExceeded();
    }

    const body = await parseJsonBody<ResendInviteBody>(req);
    if (!body.success) return body.response;

    const { userId } = body.data;
    if (!userId) {
      return Errors.badRequest('User ID is required');
    }

    const getUserResponse = await fetch(
      `${getSupabaseUrl()}/auth/v1/admin/users/${userId}`,
      { headers: adminHeaders() }
    );

    if (!getUserResponse.ok) {
      const errorText = await getUserResponse.text();
      console.error('Error fetching user:', errorText);
      return Errors.notFound('User not found');
    }

    const targetUser = await getUserResponse.json();
    const targetEmail = targetUser.email;
    if (!targetEmail) {
      return Errors.badRequest('User does not have an email address');
    }

    if (targetUser.email_confirmed_at || targetUser.confirmed_at) {
      return Errors.badRequest('Cannot resend invite: user has already confirmed their account');
    }

    const siteUrl = Deno.env.get('SITE_URL');
    if (!siteUrl) {
      console.error('SITE_URL environment variable is not set');
      return Errors.serverError('Server configuration error');
    }

    // Using 'magiclink' type because 'invite' fails with "email_exists" for already-invited users
    const generateLinkResponse = await fetch(
      `${getSupabaseUrl()}/auth/v1/admin/generate_link`,
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          type: 'magiclink',
          email: targetEmail,
          options: {
            redirect_to: `${siteUrl}/set-password`,
            data: targetUser.user_metadata || {},
          },
        }),
      }
    );

    if (!generateLinkResponse.ok) {
      const errorText = await generateLinkResponse.text();
      console.error(`Error generating invite link (${generateLinkResponse.status}):`, errorText);
      if (generateLinkResponse.status >= 400 && generateLinkResponse.status < 500) {
        let detail = 'Invite failed';
        try { const parsed = JSON.parse(errorText); detail = parsed.msg || parsed.message || detail; } catch { /* ignore parse error */ }
        return Errors.badRequest(detail);
      }
      return Errors.serverError('Invite failed: unexpected server error');
    }

    const { action_link } = await generateLinkResponse.json();

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return Errors.configError('Email service not configured');
    }

    const contactName = targetUser.user_metadata?.contact_name || targetEmail;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Ariete Capital <noreply@arietecapital.com>',
        to: [targetEmail],
        template: {
          id: Deno.env.get('RESEND_TEMPLATE_INVITE')!,
          variables: {
            bankportaluser: contactName,
            actionlink: action_link,
          },
        },
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`Error sending email via Resend (${emailResponse.status}):`, errorText);
      let detail = 'Failed to send invitation email';
      try { const parsed = JSON.parse(errorText); detail = parsed.message || detail; } catch { /* ignore parse error */ }
      return Errors.serverError(detail);
    }

    logAdminAction(airtableConfig, adminAuditTableId, {
      action: 'RESEND_INVITE', performedBy: userEmail, targetEmail,
      details: `Resent invite to ${targetEmail}`, result: 'SUCCESS',
    });

    return successResponse({
      message: `Invitation resent to ${targetEmail}`,
    });
  } catch (error) {
    console.error('Error in resend-invite:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while resending invitation');
  }
});
