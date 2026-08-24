import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest, createAdminClient } from "../_shared/auth-handler.ts";
import { handleCors, successResponse, Errors, parseJsonBody } from "../_shared/response-formatter.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

// Mirrors the client-side rule in SetPassword.tsx, but this is the copy that
// actually decides. The client's zod schema is advisory - anyone can skip the
// form and PATCH /auth/v1/user directly, where the only floor is GoTrue's
// minimum_password_length. Keeping the real check here means the policy holds
// no matter how the password is submitted.
const setPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')  // bcrypt truncates past 72
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // The whole point of this endpoint is to serve callers who have no
    // password yet - an invitee holding a session minted by their invite link.
    // It is the ONLY endpoint that opts out of the password gate.
    const auth = await authenticateRequest(req, { allowPasswordNotSet: true });
    if (!auth.success) return auth.response;

    const { user } = auth.context;

    const rateLimit = await checkRateLimit(`set-password:${user.id}`, 5, 60);
    if (!rateLimit.allowed) return Errors.rateLimitExceeded();

    const body = await parseJsonBody<z.infer<typeof setPasswordSchema>>(req);
    if (!body.success) return body.response;

    const validation = setPasswordSchema.safeParse(body.data);
    if (!validation.success) {
      return Errors.validationError(validation.error.errors[0]?.message || 'Invalid password');
    }

    // Set it through the admin API rather than letting the browser call
    // auth.updateUser() itself, so the policy above is unavoidable.
    //
    // password_set is written explicitly here, in the same call as the
    // password, so this function is correct on its own. The DB trigger in
    // 20260824000000_require_password_set.sql derives the same flag from
    // auth.users.encrypted_password and makes it impossible for any OTHER path
    // to leave the two out of sync - but that migration needs the database
    // password to apply, so nothing here is allowed to depend on it having run.
    // Writing both together means the flag is never set for an account whose
    // password write failed.
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: validation.data.password,
      app_metadata: { ...(user.app_metadata ?? {}), password_set: true },
    });

    if (error) {
      console.error('Error setting password:', error.message);
      // GoTrue rejects reusing the current password on some configurations;
      // surface its message rather than a generic failure.
      return Errors.badRequest(error.message || 'Failed to set password');
    }

    return successResponse({ message: 'Password set successfully' });
  } catch (error) {
    console.error('Error in set-password:', error instanceof Error ? error.message : 'Unknown error');
    return Errors.serverError('An error occurred while setting your password');
  }
});
