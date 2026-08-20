import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest, createAdminClient, getSupabaseUrl, getServiceRoleHeaders } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getAirtableConfig, getTableIds, fetchRecord, AIRTABLE_RECORD_ID_REGEX } from "../_shared/airtable-fetcher.ts";
import { logAdminAction } from "../_shared/admin-audit-logger.ts";

const inviteSchema = z.object({
  email: z.string().trim().email("Invalid email format").max(255),
  contactName: z.string().trim().min(1, "Contact name is required").max(100),
  bankId: z.string().trim().regex(AIRTABLE_RECORD_ID_REGEX, "Invalid bank ID"),
  role: z.enum(['admin', 'bank_staff']).default('bank_staff'),
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

    const rateLimit = await checkRateLimit(`invite-user:${user.id}`, 10, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<z.infer<typeof inviteSchema>>(req);
    if (!body.success) return body.response;

    const validation = inviteSchema.safeParse(body.data);
    if (!validation.success) return Errors.badRequest('Invalid input data');

    const { email, contactName, bankId, role } = validation.data;

    const banksTableId = getTableIds().banks;
    if (!airtableConfig || !banksTableId) return Errors.configError('Banks table not configured');
    const bankCheck = await fetchRecord(airtableConfig, banksTableId, bankId);
    if (!bankCheck.success) return Errors.badRequest('Invalid bank ID');

    const supabaseAdmin = createAdminClient();

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles').select('id, email').eq('email', email).maybeSingle();

    if (existingProfile) {
      const { error: updateError } = await supabaseAdmin.from('profiles').upsert({
        id: existingProfile.id, email, contact_name: contactName, bank_id: bankId, updated_at: new Date().toISOString(),
      });
      if (updateError) return Errors.serverError('Failed to update user profile');

      const { data: existingRole } = await supabaseAdmin
        .from('user_roles').select('role').eq('user_id', existingProfile.id).maybeSingle();
      if (!existingRole) {
        await supabaseAdmin.from('user_roles').insert({ user_id: existingProfile.id, role });
      }

      logAdminAction(airtableConfig, adminAuditTableId, {
        action: 'INVITE', performedBy: userEmail, targetEmail: email,
        details: `Updated existing profile for ${email} (bank_id: ${bankId}, role: ${role})`, result: 'SUCCESS',
      });

      return successResponse({ message: 'User profile updated successfully', userId: existingProfile.id });
    }

    const siteUrl = Deno.env.get('SITE_URL');
    if (!siteUrl) return Errors.serverError('Server configuration error');

    const generateLinkResponse = await fetch(`${getSupabaseUrl()}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: getServiceRoleHeaders(),
      body: JSON.stringify({
        type: 'invite', email,
        options: { redirect_to: `${siteUrl}/set-password`, data: { contact_name: contactName, bank_id: bankId } },
      }),
    });

    if (!generateLinkResponse.ok) {
      const errorText = await generateLinkResponse.text();
      if (generateLinkResponse.status >= 400 && generateLinkResponse.status < 500) {
        let detail = 'Invite failed';
        try { const parsed = JSON.parse(errorText); detail = parsed.msg || parsed.message || detail; } catch { /* ignore parse error */ }
        return Errors.badRequest(detail);
      }
      return Errors.serverError('Invite failed: unexpected server error');
    }

    const generateLinkData = await generateLinkResponse.json();
    const invitedUserId = generateLinkData.id;
    const actionLink = generateLinkData.action_link;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return Errors.configError('Email service not configured');

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Ariete Capital <noreply@arietecapital.com>',
        to: [email],
        template: { id: Deno.env.get('RESEND_TEMPLATE_INVITE')!, variables: { bankportaluser: contactName, actionlink: actionLink } },
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      let detail = 'Failed to send invitation email';
      try { const parsed = JSON.parse(errorText); detail = parsed.message || detail; } catch { /* ignore parse error */ }
      return Errors.serverError(detail);
    }

    // These were previously fire-and-forget: if either write failed, the
    // function still logged and returned success, leaving an invited user
    // with an auth account but no bank_id and/or no role row - and
    // get-users' `rolesMap.get(id) || 'bank_staff'` display fallback would
    // then mask a missing role as if it had been correctly set to
    // bank_staff, silently downgrading a requested admin invite.
    if (invitedUserId) {
      const { error: profileWriteError } = await supabaseAdmin.from('profiles').upsert({
        id: invitedUserId, email, contact_name: contactName, bank_id: bankId, updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (profileWriteError) {
        console.error('Error writing profile for invited user:', profileWriteError.message);
        return Errors.serverError('Invitation email sent, but failed to save the user profile. Contact support.');
      }

      const { error: roleWriteError } = await supabaseAdmin.from('user_roles').insert({ user_id: invitedUserId, role });
      if (roleWriteError) {
        console.error('Error writing role for invited user:', roleWriteError.message);
        return Errors.serverError('Invitation email sent, but failed to assign the user role. Contact support.');
      }
    }

    logAdminAction(airtableConfig, adminAuditTableId, {
      action: 'INVITE', performedBy: userEmail, targetEmail: email,
      details: `Invited new user ${email} (bank_id: ${bankId}, role: ${role})`, result: 'SUCCESS',
    });

    return successResponse({ message: 'Invitation sent successfully', userId: invitedUserId });
  } catch (error) {
    console.error('Error in invite-user:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while inviting user');
  }
});
