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
SITE_URL="${SITE_URL:-http://localhost:8080}"

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


echo "== Password gate: an invited session with no password set cannot read data =="
# Regression guard for the invite-onboarding hole: GoTrue's /auth/v1/verify
# mints a full token pair for an invite link, so "holds a valid session" and
# "has completed onboarding" are different things. A session in that state
# read live Bank Accounts data in production before this was closed.
INVITE_EMAIL="smoke-nopassword-$$@example.com"
INVITE_LINK_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/generate_link" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"invite\",\"email\":\"$INVITE_EMAIL\",\"redirect_to\":\"$SITE_URL/set-password\"}")
INVITE_USER_ID=$(echo "$INVITE_LINK_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
INVITE_ACTION_LINK=$(echo "$INVITE_LINK_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('action_link',''))" 2>/dev/null)

if [ -z "$INVITE_USER_ID" ] || [ -z "$INVITE_ACTION_LINK" ]; then
  echo "  FAIL: could not generate an invite link to test with"
  FAIL=$((FAIL + 1))
else
  # The generated link must actually point at the form. These four functions
  # used to send redirect_to nested under `options`, which is the supabase-js
  # client shape rather than the REST one - GoTrue ignored it and fell back to
  # Site URL, so invitees landed on the app root and never saw the form.
  check "generate_link preserves the /set-password path" \
    "$(echo "$INVITE_ACTION_LINK" | grep -q "redirect_to=$SITE_URL/set-password" && echo true || echo false)"

  # Give the invitee a bank, so the next check fails for the intended reason
  # (no password) rather than for a missing bank_id.
  curl -s -o /dev/null -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$INVITE_USER_ID" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" -H "Prefer: return=minimal" \
    -d '{"bank_id":"recJnFxg7L6qTPd6M"}'

  # Click the link the way a real invitee's browser would, and keep the session
  # it hands back.
  INVITE_LOCATION=$(curl -s -o /dev/null -D - "$INVITE_ACTION_LINK" | grep -i "^location:" | tr -d '\r')
  INVITE_TOKEN=$(echo "$INVITE_LOCATION" | sed -n 's/.*access_token=\([^&]*\).*/\1/p')

  if [ -z "$INVITE_TOKEN" ]; then
    echo "  FAIL: invite link did not yield a session to test with"
    FAIL=$((FAIL + 1))
  else
    NOPASS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/functions/v1/get-bank-accounts" \
      -H "Authorization: Bearer $INVITE_TOKEN")
    check "get-bank-accounts returns 403 for a session with no password set" \
      "$([ "$NOPASS_STATUS" = "403" ] && echo true || echo false)"

    # set-password is the one endpoint such a session must still reach.
    SETPW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/functions/v1/set-password" \
      -H "Authorization: Bearer $INVITE_TOKEN" -H "Content-Type: application/json" \
      -d '{"password":"SmokeTest123"}')
    check "set-password accepts a session with no password set" \
      "$([ "$SETPW_STATUS" = "200" ] && echo true || echo false)"

    # And the weak-password policy is enforced server-side, not just in the form.
    WEAK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/functions/v1/set-password" \
      -H "Authorization: Bearer $INVITE_TOKEN" -H "Content-Type: application/json" \
      -d '{"password":"weak"}')
    check "set-password rejects a password that fails the strength policy" \
      "$([ "$WEAK_STATUS" = "400" ] && echo true || echo false)"

    # Having set one, the same session should now get through the gate.
    AFTER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/functions/v1/get-bank-accounts" \
      -H "Authorization: Bearer $INVITE_TOKEN")
    check "get-bank-accounts admits the session once a password is set" \
      "$([ "$AFTER_STATUS" = "200" ] && echo true || echo false)"
  fi

  curl -s -o /dev/null -X DELETE "$SUPABASE_URL/auth/v1/admin/users/$INVITE_USER_ID" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
fi

echo "== Static guard: no generate_link call may nest redirect_to under options =="
# Cheap check, but it is the one that actually stops this class of bug coming
# back: the REST endpoint silently ignores the nested form instead of erroring,
# so nothing else in CI would notice.
NESTED_SHAPE=$(grep -rn "options: {" "$(dirname "$0")/../supabase/functions" --include=index.ts | wc -l | tr -d ' ')
check "no edge function nests generate_link params under options" \
  "$([ "$NESTED_SHAPE" = "0" ] && echo true || echo false)"

echo
echo "== Results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
