import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest, createAdminClient, getSupabaseUrl, getServiceRoleHeaders } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getAirtableConfig, getTableIds, fetchRecord } from "../_shared/airtable-fetcher.ts";
import { logAdminAction } from "../_shared/admin-audit-logger.ts";

const bulkInviteSchema = z.object({
  entries: z.array(z.object({
    email: z.string().trim().email("Invalid email format").max(255),
    contactName: z.string().trim().min(1, "Contact name is required").max(100),
  })).min(1, "At least one entry is required").max(50, "Maximum 50 entries per batch"),
  bankId: z.string().trim().min(1, "Bank is required").max(100),
  role: z.enum(['admin', 'bank_staff']).default('bank_staff'),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await authenticateRequest(req, { requireAdmin: true });
    if (!auth.success) return auth.response;

    const { userEmail } = auth.context;
    const adminAuditTableId = getTableIds().adminAuditLog;
    const airtableConfig = getAirtableConfig();

    const rateLimit = await checkRateLimit(`bulk-invite:${auth.context.user.id}`, 5, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<z.infer<typeof bulkInviteSchema>>(req, 50000);
    if (!body.success) return body.response;

    const validation = bulkInviteSchema.safeParse(body.data);
    if (!validation.success) return Errors.badRequest('Invalid input data');

    const { entries, bankId, role } = validation.data;

    const banksTableId = getTableIds().banks;
    if (!airtableConfig || !banksTableId) return Errors.configError('Banks table not configured');
    const bankCheck = await fetchRecord(airtableConfig, banksTableId, bankId);
    if (!bankCheck.success) return Errors.badRequest('Invalid bank ID');

    const supabaseAdmin = createAdminClient();

    const existingUsersMap = new Map<string, { id: string; email: string }>();
    try {
      const authResponse = await fetch(
        `${getSupabaseUrl()}/auth/v1/admin/users?per_page=1000`,
        { headers: getServiceRoleHeaders() }
      );
      if (authResponse.ok) {
        const authData = await authResponse.json();
        const authUsers = authData.users || authData;
        if (Array.isArray(authUsers)) {
          authUsers.forEach((u: { id: string; email?: string }) => {
            if (u.email) existingUsersMap.set(u.email, { id: u.id, email: u.email });
          });
        }
      }
    } catch (err) {
      console.error('Error fetching existing users:', err);
    }

    const siteUrl = Deno.env.get('SITE_URL');
    if (!siteUrl) {
      console.error('SITE_URL environment variable is not set');
      return Errors.serverError('Server configuration error');
    }

    const results: { succeeded: string[]; failed: { email: string; error: string }[] } = {
      succeeded: [],
      failed: [],
    };

    for (const entry of entries) {
      const trimmedEmail = entry.email.trim().toLowerCase();
      const contactName = entry.contactName.trim();
      if (!trimmedEmail || !contactName) continue;

      try {
        const existingUser = existingUsersMap.get(trimmedEmail);

        if (existingUser) {
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: existingUser.id,
              email: trimmedEmail,
              contact_name: contactName,
              bank_id: bankId,
              updated_at: new Date().toISOString(),
            });

          if (updateError) {
            console.error(`Error updating profile for ${trimmedEmail}:`, updateError.message);
            results.failed.push({ email: trimmedEmail, error: 'Failed to update profile' });
            continue;
          }

          const { data: existingRole } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', existingUser.id)
            .maybeSingle();

          if (!existingRole) {
            const { error: insertRoleError } = await supabaseAdmin
              .from('user_roles')
              .insert({ user_id: existingUser.id, role });

            if (insertRoleError) {
              console.error(`Error inserting role for ${trimmedEmail}:`, insertRoleError.message);
              results.failed.push({ email: trimmedEmail, error: 'Failed to assign role' });
              continue;
            }
          }

          results.succeeded.push(trimmedEmail);
        } else {
          const inviteResponse = await fetch(
            `${getSupabaseUrl()}/auth/v1/invite`,
            {
              method: 'POST',
              headers: getServiceRoleHeaders(),
              body: JSON.stringify({
                email: trimmedEmail,
                data: { contact_name: contactName, bank_id: bankId },
              }),
            }
          );

          if (!inviteResponse.ok) {
            const errorText = await inviteResponse.text();
            console.error(`Error inviting ${trimmedEmail}:`, errorText);
            let detail = 'Failed to send invitation';
            try { const parsed = JSON.parse(errorText); detail = parsed.msg || parsed.message || detail; } catch { /* ignore parse error */ }
            results.failed.push({ email: trimmedEmail, error: detail });
            continue;
          }

          const inviteData = await inviteResponse.json();
          const newUserId = inviteData.id;

          if (newUserId) {
            await supabaseAdmin
              .from('profiles')
              .upsert({
                id: newUserId,
                email: trimmedEmail,
                contact_name: contactName,
                bank_id: bankId,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' });

            const { error: insertRoleError } = await supabaseAdmin
              .from('user_roles')
              .insert({ user_id: newUserId, role });

            if (insertRoleError) {
              console.error(`Error inserting role for ${trimmedEmail}:`, insertRoleError.message);
              results.failed.push({ email: trimmedEmail, error: 'Failed to assign role' });
              continue;
            }
          }

          results.succeeded.push(trimmedEmail);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.failed.push({ email: trimmedEmail, error: errorMsg });
        console.error(`Error processing ${trimmedEmail}:`, errorMsg);
      }
    }

    logAdminAction(airtableConfig, adminAuditTableId, {
      action: 'BULK_INVITE', performedBy: userEmail, targetEmail: `${entries.length} entries`,
      details: `Bulk invite to bank_id ${bankId}: ${results.succeeded.length} succeeded, ${results.failed.length} failed`,
      result: results.failed.length === 0 ? 'SUCCESS' : 'FAIL',
    });

    return successResponse({
      succeeded: results.succeeded.length,
      failed: results.failed,
      total: entries.length,
    });
  } catch (error) {
    console.error('Error in bulk-invite:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred during bulk invitation');
  }
});
