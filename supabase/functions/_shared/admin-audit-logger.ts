import { AirtableConfig, createRecord } from "./airtable-fetcher.ts";

export type AdminAction = 'INVITE' | 'BULK_INVITE' | 'UPDATE' | 'DELETE' | 'RESEND_INVITE' | 'RESET_PASSWORD';

export interface AdminAuditParams {
  action: AdminAction;
  performedBy: string;
  targetEmail: string;
  details: string;
  result: 'SUCCESS' | 'FAIL';
}

// A real Airtable table ID always looks like tbl + 14 alphanumeric chars.
// AIRTABLE_ADMIN_AUDIT_LOG_TABLE_ID has shipped as the literal placeholder
// "REPLACE_ME_tbl_admin_audit_log" in at least one environment - that string
// is truthy, so the old `if (!tableId)` guard never caught it, and every
// audit write silently attempted (and failed) against a nonexistent table.
const REAL_TABLE_ID = /^tbl[a-zA-Z0-9]+$/;

// Any "fire and forget after the response is sent" background write (audit
// logs, in this codebase) needs EdgeRuntime.waitUntil, or the edge runtime
// can tear down the isolate right after the response is returned - killing
// the write, or even its own .catch() handler, before either ever runs.
// Shared so every audit-log call site (admin actions here, and the
// AML-status-change log in update-bank-account-status) gets the same
// guarantee instead of re-implementing this by hand.
export function backgroundTask(promise: Promise<unknown>): void {
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(promise);
  }
}

// Non-blocking by design - an audit-log write failing must never break the
// admin action it's logging. Two bugs previously made failures invisible:
// (1) createRecord() resolves {success:false} on an Airtable API error
// rather than throwing, so a bare `.catch()` never fired for that case;
// (2) the isolate-teardown race described above on backgroundTask().
export function logAdminAction(
  config: AirtableConfig | null,
  tableId: string | undefined,
  params: AdminAuditParams,
): void {
  if (!config || !tableId) {
    console.warn('[AdminAudit] Missing Airtable config or table ID, skipping audit log');
    return;
  }
  if (!REAL_TABLE_ID.test(tableId)) {
    console.error(`[AdminAudit] AIRTABLE_ADMIN_AUDIT_LOG_TABLE_ID looks unconfigured ("${tableId}") - skipping audit log write`);
    return;
  }

  backgroundTask(
    createRecord(config, tableId, {
      action: params.action,
      performed_by: params.performedBy,
      target_email: params.targetEmail,
      details: params.details,
      result: params.result,
      timestamp: new Date().toISOString(),
    }).then((result) => {
      if (!result.success) console.error('[AdminAudit] Failed to write admin audit log:', result.error);
    }).catch((err) => console.error('[AdminAudit] Failed to write admin audit log:', err))
  );
}
