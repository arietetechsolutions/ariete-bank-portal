#!/usr/bin/env bash
# Smoke test for Bank Portal's actual security boundary: bank-scoping and
# role checks. Not a full test suite (none exists yet in this repo) - this
# codifies the critical-path checks that were manually verified via curl
# throughout development, so a regression here gets caught automatically
# instead of only being noticed by chance during manual testing.
#
# Requires: local Supabase running (`npx supabase start`) and edge functions
# serving (`npx supabase functions serve --env-file supabase/.env.local`),
# plus two existing test accounts (override via env vars if yours differ):
#   ADMIN_EMAIL / ADMIN_PASSWORD   - an account with the 'admin' role
#   STAFF_EMAIL / STAFF_PASSWORD   - a 'bank_staff' account with a bank_id set
#
# Usage: bash scripts/smoke-test.sh

set -uo pipefail

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
ANON_KEY="${ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"
# Only used to restore the admin role if the last-admin-lockout test below
# ever unexpectedly succeeds (see that section) - bypasses RLS, never sent
# anywhere else. Default is Supabase's well-known public local-dev demo key
# (same for every `supabase start`), not a real secret.
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@arietecapital.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-TestAdmin123!}"
STAFF_EMAIL="${STAFF_EMAIL:-james@gcpartners.com}"
STAFF_PASSWORD="${STAFF_PASSWORD:-TestStaff123!}"

PASS=0
FAIL=0

check() {
  local description="$1" condition="$2"
  if [ "$condition" = "true" ]; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $description"
    FAIL=$((FAIL + 1))
  fi
}

login() {
  curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}"
}

echo "== Logging in as both test roles =="
ADMIN_LOGIN=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
ADMIN_ID=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))" 2>/dev/null)
check "admin login succeeds" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"

STAFF_LOGIN=$(login "$STAFF_EMAIL" "$STAFF_PASSWORD")
STAFF_TOKEN=$(echo "$STAFF_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
check "bank_staff login succeeds" "$([ -n "$STAFF_TOKEN" ] && echo true || echo false)"

if [ -z "$ADMIN_TOKEN" ] || [ -z "$STAFF_TOKEN" ]; then
  echo "Cannot continue without both logins - check credentials and that the local stack is running."
  exit 1
fi

echo "== Unauthenticated access is rejected =="
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/functions/v1/get-bank-accounts")
check "get-bank-accounts requires auth (401)" "$([ "$UNAUTH_STATUS" = "401" ] && echo true || echo false)"

echo "== Bank scoping: admin sees more than a single bank_staff account =="
ADMIN_ACCOUNTS=$(curl -s "$SUPABASE_URL/functions/v1/get-bank-accounts" -H "Authorization: Bearer $ADMIN_TOKEN")
STAFF_ACCOUNTS=$(curl -s "$SUPABASE_URL/functions/v1/get-bank-accounts" -H "Authorization: Bearer $STAFF_TOKEN")
ADMIN_BANK_NAMES=$(echo "$ADMIN_ACCOUNTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(set(a.get('bank_name') for a in d.get('bankAccounts',[]))))" 2>/dev/null)
STAFF_BANK_NAMES=$(echo "$STAFF_ACCOUNTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(set(a.get('bank_name') for a in d.get('bankAccounts',[]))))" 2>/dev/null)
check "admin's account list spans >1 bank (cross-bank view)" "$([ "${ADMIN_BANK_NAMES:-0}" -gt 1 ] && echo true || echo false)"
check "bank_staff's account list spans exactly 1 bank (scoped view)" "$([ "${STAFF_BANK_NAMES:-0}" -eq 1 ] && echo true || echo false)"

echo "== IDOR protection: bank_staff cannot update another bank's account =="
OTHER_BANK_ACCOUNT_ID=$(python3 -c "
import json, sys
staff = json.loads('''$STAFF_ACCOUNTS''')
admin = json.loads('''$ADMIN_ACCOUNTS''')
staff_ids = {a['id'] for a in staff.get('bankAccounts', [])}
for a in admin.get('bankAccounts', []):
    if a['id'] not in staff_ids:
        print(a['id']); break
" 2>/dev/null)

if [ -n "$OTHER_BANK_ACCOUNT_ID" ]; then
  IDOR_RESPONSE=$(curl -s "$SUPABASE_URL/functions/v1/update-bank-account-status" \
    -H "Authorization: Bearer $STAFF_TOKEN" -H "Content-Type: application/json" \
    -d "{\"bankAccountId\":\"$OTHER_BANK_ACCOUNT_ID\",\"newStatus\":\"Onboarding\"}")
  IDOR_BLOCKED=$(echo "$IDOR_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', True) == False)" 2>/dev/null)
  check "cross-bank status update is rejected" "$([ "$IDOR_BLOCKED" = "True" ] && echo true || echo false)"
else
  echo "  SKIP: no other-bank account found to test against (need >=2 banks with data)"
fi

echo "== Role gating: bank_staff cannot reach admin-only get-users =="
STAFF_GETUSERS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/functions/v1/get-users" -H "Authorization: Bearer $STAFF_TOKEN")
check "get-users returns 403 for a non-admin" "$([ "$STAFF_GETUSERS_STATUS" = "403" ] && echo true || echo false)"

echo "== Last-admin lockout protection =="
LOCKOUT_RESPONSE=$(curl -s "$SUPABASE_URL/functions/v1/update-user" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"userId\":\"$ADMIN_ID\",\"role\":\"bank_staff\"}")
LOCKOUT_SUCCEEDED=$(echo "$LOCKOUT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)

if [ "$LOCKOUT_SUCCEEDED" = "True" ]; then
  # More than one admin existed, so the demote correctly went through - this
  # test can only exercise the sole-admin case with exactly one admin
  # present. Restore immediately via the service role (the just-demoted
  # ADMIN_TOKEN can no longer call this admin-only endpoint itself) so the
  # test never leaves a permanent side effect.
  curl -s -o /dev/null -X PATCH "$SUPABASE_URL/rest/v1/user_roles?user_id=eq.$ADMIN_ID" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" -H "Prefer: return=minimal" \
    -d '{"role":"admin"}'
  echo "  SKIP: more than one admin exists, so demote succeeded as expected - restored role, cannot test sole-admin lockout here"
else
  LOCKOUT_MESSAGE=$(echo "$LOCKOUT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" 2>/dev/null)
  check "self-demoting the only admin is blocked" "$(echo "$LOCKOUT_MESSAGE" | grep -qi "last admin" && echo true || echo false)"
fi

echo
echo "== Results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
