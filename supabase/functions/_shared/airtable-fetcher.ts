// Real Airtable record IDs are always "rec" + 14 alphanumeric chars. Record
// IDs reach these functions from client-supplied fields (bankId,
// bankAccountId) that were previously validated only as "non-empty string
// up to N chars" - nothing stopped a value like "recXXX/../otherTableId/rec"
// from being submitted. fetchRecord/updateRecord below interpolate recordId
// into the URL path unescaped, so an unvalidated value could traverse to a
// different table in the same Airtable base (which, per this base's schema,
// includes Registry/Clients/Leads - well beyond what Bank Accounts access
// should expose). Export this so every call site validates client-supplied
// IDs with it before they ever reach fetchRecord/updateRecord.
export const AIRTABLE_RECORD_ID_REGEX = /^rec[a-zA-Z0-9]{14}$/;

export interface AirtableConfig { apiKey: string; baseId: string; }
export interface AirtableRecord { id: string; createdTime: string; fields: Record<string, unknown>; }
export interface FetchOptions {
  filterFormula?: string;
  fields?: string[];
  sort?: { field: string; direction?: 'asc' | 'desc' }[];
  maxRecords?: number;
}

export function getAirtableConfig(): AirtableConfig | null {
  const apiKey = Deno.env.get('AIRTABLE_API_KEY');
  const baseId = Deno.env.get('AIRTABLE_BASE_ID');
  if (!apiKey || !baseId) { console.error('Missing Airtable configuration'); return null; }
  return { apiKey, baseId };
}

export function getTableIds() {
  return {
    bankAccounts: Deno.env.get('AIRTABLE_BANK_ACCOUNTS_TABLE_ID'),
    banks: Deno.env.get('AIRTABLE_BANKS_TABLE_ID'),
    auditLog: Deno.env.get('AIRTABLE_AUDIT_LOG_TABLE_ID'),
    adminAuditLog: Deno.env.get('AIRTABLE_ADMIN_AUDIT_LOG_TABLE_ID'),
  };
}

export async function fetchAllRecords(
  config: AirtableConfig, tableId: string, options: FetchOptions = {}
): Promise<{ success: true; records: AirtableRecord[] } | { success: false; error: string }> {
  const { apiKey, baseId } = config;
  const { filterFormula, fields, sort, maxRecords } = options;
  const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`;
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (offset) params.set('offset', offset);
    if (filterFormula) params.set('filterByFormula', filterFormula);
    if (fields) fields.forEach(f => params.append('fields[]', f));
    if (sort) sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      if (s.direction) params.set(`sort[${i}][direction]`, s.direction);
    });
    if (maxRecords) params.set('maxRecords', maxRecords.toString());

    const url = params.toString() ? `${baseUrl}?${params}` : baseUrl;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Airtable API error: ${response.status}`, errorText);
      return { success: false, error: `Airtable API error: ${response.status}` };
    }

    const data = await response.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;
    if (maxRecords && allRecords.length >= maxRecords) break;
  } while (offset);

  return { success: true, records: allRecords };
}

export async function fetchRecord(
  config: AirtableConfig, tableId: string, recordId: string
): Promise<{ success: true; record: AirtableRecord } | { success: false; error: string }> {
  const { apiKey, baseId } = config;
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${encodeURIComponent(recordId)}`;
  const response = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
  if (!response.ok) {
    return { success: false, error: response.status === 404 ? 'Record not found' : `Airtable API error: ${response.status}` };
  }
  return { success: true, record: await response.json() };
}

export async function createRecord(
  config: AirtableConfig, tableId: string, fields: Record<string, unknown>
): Promise<{ success: true; record: AirtableRecord } | { success: false; error: string }> {
  const { apiKey, baseId } = config;
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    return { success: false, error: `Failed to create record: ${response.status}` };
  }
  return { success: true, record: await response.json() };
}

export async function updateRecord(
  config: AirtableConfig, tableId: string, recordId: string, fields: Record<string, unknown>
): Promise<{ success: true; record: AirtableRecord } | { success: false; error: string }> {
  const { apiKey, baseId } = config;
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${encodeURIComponent(recordId)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    return { success: false, error: `Failed to update record: ${response.status}` };
  }
  return { success: true, record: await response.json() };
}

export function buildLookupMap(records: AirtableRecord[], valueField: string | string[]): Map<string, string> {
  const map = new Map<string, string>();
  const fields = Array.isArray(valueField) ? valueField : [valueField];
  for (const record of records) {
    for (const field of fields) {
      const value = record.fields[field];
      if (value && typeof value === 'string') { map.set(record.id, value); break; }
    }
  }
  return map;
}

export function resolveLookup(value: unknown, lookupMap: Map<string, string>): string {
  if (Array.isArray(value) && value.length > 0) return lookupMap.get(value[0]) || value[0];
  if (typeof value === 'string') return lookupMap.get(value) || value;
  return '';
}
