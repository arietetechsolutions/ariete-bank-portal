-- The "Users can update own profile" policy had no WITH CHECK clause, so
-- Postgres reused USING (auth.uid() = id) for it - that only constrains the
-- row's id, not any other column. Combined with the table-wide UPDATE grant
-- below, any authenticated user could PATCH their own bank_id directly via
-- PostgREST to any other bank's Airtable record id, bypassing every
-- server-side bank-scoping check in the edge functions (which all trust
-- profiles.bank_id as authoritative). bank_id must only ever be writable by
-- the service-role admin functions.

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, contact_name, updated_at) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
