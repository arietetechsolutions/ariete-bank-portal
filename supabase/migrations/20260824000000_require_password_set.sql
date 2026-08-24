-- =============================================
-- Make "has this account ever set a password?" visible to the application.
-- =============================================
--
-- An invite link is itself a login: GoTrue's /auth/v1/verify?type=invite
-- mints a full access + refresh token pair before the app has any say. Until
-- now nothing downstream checked whether the invitee ever went on to set a
-- password - ProtectedRoute gated on "a user exists" and authenticateRequest
-- gated on "the token is valid" - so a clicked invite email was, by itself,
-- permanent access to the portal. A session minted that way read live Bank
-- Accounts data in a production test.
--
-- The blocker is visibility, not policy: auth.users.encrypted_password is the
-- ground truth, but neither the frontend nor an edge function can see it -
-- they only ever observe a user through the Auth API and the JWT, which
-- expose app_metadata. So mirror the fact into app_metadata, where both can
-- read it.
--
-- app_metadata specifically, NOT user_metadata: user_metadata is writable by
-- the user themselves via auth.updateUser(), which would let an invitee flip
-- their own gate open. app_metadata is service-role-only and is carried
-- inside the signed JWT, so the gate cannot be forged client-side and costs
-- no extra round trip to check.
--
-- Maintained by trigger rather than by application code on purpose. Every
-- path that can create a user or set a password - invite-user, bulk-invite,
-- the set-password function, an admin using Supabase Studio, a raw admin API
-- call - would otherwise have to remember to maintain the flag, and the one
-- that forgets fails OPEN. Deriving it from encrypted_password means the
-- mirror cannot drift and no future call site has to know the rule exists.

CREATE OR REPLACE FUNCTION auth.sync_password_set_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = auth, public
AS $$
BEGIN
  NEW.raw_app_meta_data =
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
         'password_set',
         NEW.encrypted_password IS NOT NULL AND length(NEW.encrypted_password) > 0
       );
  RETURN NEW;
END;
$$;

-- BEFORE INSERT: every newly created account starts with the flag present and
-- honest. A brand-new invitee has no password, so it lands false - the gate
-- fails CLOSED for anyone the app has not explicitly seen set a password.
DROP TRIGGER IF EXISTS sync_password_set_flag_on_insert ON auth.users;
CREATE TRIGGER sync_password_set_flag_on_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.sync_password_set_flag();

-- BEFORE UPDATE, but only when the password actually changes. Restricting it
-- to that column keeps the flag from being recomputed on unrelated writes
-- (last_sign_in_at churns on every single login) and means setting a password
-- through ANY mechanism flips the flag, including ones this app does not own.
DROP TRIGGER IF EXISTS sync_password_set_flag_on_update ON auth.users;
CREATE TRIGGER sync_password_set_flag_on_update
  BEFORE UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  WHEN (NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password)
  EXECUTE FUNCTION auth.sync_password_set_flag();

-- Backfill every account that already exists. This MUST land before the
-- enforcement in authenticateRequest ships: without it every current user
-- reads as "no password set" and the whole team, admins included, gets bounced
-- to /set-password on their next request.
UPDATE auth.users
SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
           'password_set',
           encrypted_password IS NOT NULL AND length(encrypted_password) > 0
         );
