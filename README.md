# Ariete Bank Portal

A scoped portal for GC Partners / CBH bank staff to track and update the account-opening status of Golden Visa clients Ariete has referred to them, plus an internal admin screen for managing bank-staff logins. Built as an architectural clone of Ariete's Agent Portal (Vite + React + Supabase), with Airtable as the business-data source.

Not yet deployed — production URL/hosting is still to be decided. Everything below runs the app locally on your own machine.

## Stack

Vite + React + TypeScript, Tailwind CSS + shadcn/ui, Supabase (self-hosted) for auth only, Airtable for all business data, Resend for transactional email.

## Local development

Requires Docker (for the local Supabase stack) and Node.

```bash
npm install

# Start local Supabase (Postgres + Auth + Studio)
npx supabase start

# In a separate terminal, serve the edge functions
npx supabase functions serve --env-file supabase/.env.local

# In another terminal, start the frontend
npm run dev
```

Once running, the app is served locally at:
- App (local only, not a hosted URL): http://localhost:8080
- Supabase Studio (view/edit local DB, create/manage users): http://127.0.0.1:54323

Copy `.env.local` and `supabase/.env.local` from the values printed by `npx supabase start`, plus real Airtable/Resend credentials. Neither file is committed — both are gitignored.

## Test accounts

`supabase db reset` (or a fresh `supabase start`) seeds two local accounts:

| Role | Email | Password |
|---|---|---|
| admin | `admin@arietecapital.com` | `TestAdmin123!` |
| bank_staff | `james@gcpartners.com` | `TestStaff123!` |

The bank_staff account's `bank_id` is set to a real GC Partners Banks record ID, so it shows live account data out of the box.

## Verifying changes

```bash
npx tsc --noEmit -p tsconfig.app.json   # type-check
npm run build                             # production build
npm run lint                              # ESLint
npm run smoke-test                        # security-boundary smoke test (needs the local stack running)
```
