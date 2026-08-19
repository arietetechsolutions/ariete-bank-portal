-- user_roles only had UNIQUE(user_id, role), which permits a user to hold
-- both an admin and a bank_staff row at once. No code path creates that
-- today, but get-users' role resolution (last row wins, no ORDER BY) would
-- behave non-deterministically if it ever happened - including potentially
-- listing an actual admin in the bank-staff management screen instead of
-- correctly excluding them. Each user should have exactly one role.

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
