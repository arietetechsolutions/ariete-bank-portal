-- Local dev-only test accounts. Only ever applied to the local Supabase
-- stack (via `supabase db reset` / `supabase start`) — never run this
-- against a real deployment.
--
--   test-admin@arietecapital.test    / TestAdmin123!  (role: admin)
--   test-bankstaff@gcpartners.test   / TestStaff123!  (role: bank_staff)
--
-- bank_id below is a real GC Partners Banks record ID from Airtable.

create extension if not exists pgcrypto;

do $$
declare
  admin_id uuid := 'a0000000-0000-4000-8000-000000000001';
  staff_id uuid := 'a0000000-0000-4000-8000-000000000002';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new
  ) values
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
     'test-admin@arietecapital.test', crypt('TestAdmin123!', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', staff_id, 'authenticated', 'authenticated',
     'test-bankstaff@gcpartners.test', crypt('TestStaff123!', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Bank Staff"}',
     now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values
    (gen_random_uuid(), admin_id, admin_id::text,
     jsonb_build_object('sub', admin_id::text, 'email', 'test-admin@arietecapital.test'),
     'email', now(), now(), now()),
    (gen_random_uuid(), staff_id, staff_id::text,
     jsonb_build_object('sub', staff_id::text, 'email', 'test-bankstaff@gcpartners.test'),
     'email', now(), now(), now())
  on conflict (provider_id, provider) do nothing;

  update public.profiles set bank_id = 'recJnFxg7L6qTPd6M' where id = staff_id;

  insert into public.user_roles (user_id, role) values
    (admin_id, 'admin'),
    (staff_id, 'bank_staff')
  on conflict do nothing;
end $$;
