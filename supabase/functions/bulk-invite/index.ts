import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createAdminClient } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getAirtableConfig, getTableIds } from "../_shared/airtable-fetcher.ts";
import { logAdminAction } from "../_shared/admin-audit-logger.ts";

interface BulkInviteEntry {
  email: string;
  contactName: string;
}

interface BulkInviteBody {
  entries: BulkInviteEntry[];
  bankId: string;
  role?: string;
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

    const { userEmail } = auth.context;
    const adminAuditTableId = getTableIds().adminAuditLog;
    const airtableConfig = getAirtableConfig();

    const rateLimit = await checkRateLimit(`bulk-invite:${auth.context.user.id}`, 5, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<BulkInviteBody>(req, 50000);
    if (!body.success) return body.response;

    const { entries, bankId, role = 'bank_staff' } = body.data;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return Errors.badRequest('At least one entry is required');
    }
    if (!bankId) {
      return Errors.badRequest('Bank ID is required');
    }
    if (entries.length > 50) {
      return Errors.badRequest('Maximum 50 entries per batch');
    }

    const supabaseAdmin = createAdminClient();

    const existingUsersMap = new Map<string, { id: string; email: string }>();
    try {
      const authResponse = await fetch(
        `${getSupabaseUrl()}/auth/v1/admin/users?per_page=1000`,
        { headers: adminHeaders() }
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
            results.failed.push({ email: trimmedEmail, error: updateError.message });
            continue;
          }

          const { data: existingRole } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', existingUser.id)
            .maybeSingle();

          if (!existingRole) {
            await supabaseAdmin
              .from('user_roles')
              .insert({ user_id: existingUser.id, role });
          }

          results.succeeded.push(trimmedEmail);
        } else {
          const inviteResponse = await fetch(
            `${getSupabaseUrl()}/auth/v1/invite`,
            {
              method: 'POST',
              headers: adminHeaders(),
              body: JSON.stringify({
                email: trimmedEmail,
                data: { contact_name: contactName, bank_id: bankId },
              }),
            }
          );

          if (!inviteResponse.ok) {
            const errorText = await inviteResponse.text();
            results.failed.push({ email: trimmedEmail, error: errorText });
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

            await supabaseAdmin
              .from('user_roles')
              .insert({ user_id: newUserId, role });
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
