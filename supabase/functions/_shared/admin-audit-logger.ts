import { AirtableConfig, createRecord } from "./airtable-fetcher.ts";

export type AdminAction = 'INVITE' | 'BULK_INVITE' | 'UPDATE' | 'DELETE' | 'RESEND_INVITE' | 'RESET_PASSWORD';

export interface AdminAuditParams {
  action: AdminAction;
  performedBy: string;
  targetEmail: string;
  details: string;
  result: 'SUCCESS' | 'FAIL';
}

// Non-blocking by design (fire-and-forget with an internal catch) - an
// audit-log write failing must never break the admin action it's logging.
export function logAdminAction(
  config: AirtableConfig | null,
  tableId: string | undefined,
  params: AdminAuditParams,
): void {
  if (!config || !tableId) {
    console.warn('[AdminAudit] Missing Airtable config or table ID, skipping audit log');
    return;
  }

  createRecord(config, tableId, {
    action: params.action,
    performed_by: params.performedBy,
    target_email: params.targetEmail,
    details: params.details,
    result: params.result,
    timestamp: new Date().toISOString(),
  }).catch((err) => console.error('[AdminAudit] Failed to write admin audit log:', err));
}
