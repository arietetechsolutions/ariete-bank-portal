-- update-user and delete-user each read the current admin count and then
-- acted on it in a separate statement - not atomic. Two concurrent requests
-- (e.g. two admins demoting/deleting each other at the same moment) could
-- each observe adminCount > 1 before either write commits, leaving zero
-- admins with no recovery path. These functions do the check and the
-- mutation together in one transaction, serialized by an advisory lock -
-- the same pattern check_rate_limit already uses for its own race safety.
--
-- This also fixes delete-user's role/profile cleanup, which previously ran
-- on the caller's own session-scoped client (no DELETE grant on either
-- table - every call silently threw "permission denied" and only appeared
-- to work because deleting the auth.users row cascades via FK).

CREATE OR REPLACE FUNCTION public.guard_and_swap_role(p_target_user_id UUID, p_new_role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(727100001);

  IF p_new_role <> 'admin' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_target_user_id AND role = 'admin'
  ) THEN
    SELECT count(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last admin. Promote another user to admin first.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_target_user_id, p_new_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_and_remove_admin_role(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(727100001);

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_target_user_id AND role = 'admin') THEN
    SELECT count(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last admin. Promote another user to admin first.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
  DELETE FROM public.profiles WHERE id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guard_and_swap_role(UUID, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_and_remove_admin_role(UUID) TO service_role;
