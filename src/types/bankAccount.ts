// These must match the option labels on the "Bank account status" single
// select in Airtable exactly - Airtable rejects a write to an option label it
// doesn't know, and the enum in update-bank-account-status/index.ts rejects
// anything not listed here before the write is even attempted. Adding a
// status means touching four places: this file, STATUS_ICONS in Dashboard.tsx,
// statusConfig in BankAccountStatusBadge.tsx, and that edge function's enum.
export type BankAccountStatus =
  | 'Registered'
  | 'Onboarding'
  | 'Account Opened'
  | 'Waiting for transfer'
  | 'Transfer made - waiting for AML letter'
  | 'AML Letter Issued'
  | 'Investment executed'
  | 'Lost';

// Order here is the pipeline order, and drives both the dropdown and the
// left-to-right order of the dashboard count tiles.
export const BANK_ACCOUNT_STATUSES: BankAccountStatus[] = [
  'Registered',
  'Onboarding',
  'Account Opened',
  'Waiting for transfer',
  'Transfer made - waiting for AML letter',
  'AML Letter Issued',
  'Investment executed',
  'Lost',
];

export interface BankAccountRecord {
  id: string;
  client_name: string;
  email: string;
  bank_name: string;
  status: BankAccountStatus | '';
  // Airtable "Status changed on" (a date-only field), or null if never
  // stamped - e.g. a record whose status has not changed since the
  // automation was added.
  status_changed_on: string | null;
  created_at: string;
}

// A stage's tone encodes WHO YOU ARE WAITING ON, not how far along the funnel
// it sits. Two stages sharing a tone share a next action, which is why
// "Account Opened" and "AML Letter Issued" are both `info` (ours to move) while
// the two transfer stages are both `gold` (waiting on the client or the bank).
export type StageTone = 'neutral' | 'info' | 'gold' | 'ok' | 'lost';

export const STAGE_TONES: Record<BankAccountStatus, StageTone> = {
  'Registered': 'neutral',
  'Onboarding': 'neutral',
  'Account Opened': 'info',
  'Waiting for transfer': 'gold',
  'Transfer made - waiting for AML letter': 'gold',
  'AML Letter Issued': 'info',
  'Investment executed': 'ok',
  'Lost': 'lost',
};

// Lost is deliberately not part of the funnel: it is an exit, and threading it
// through the stepper would imply every client passes through it. It renders as
// a detached terminal tile instead.
export const TERMINAL_STATUS: BankAccountStatus = 'Lost';
export const FUNNEL_STAGES: BankAccountStatus[] = BANK_ACCOUNT_STATUSES.filter((s) => s !== TERMINAL_STATUS);

// The final funnel stage is an endpoint, so "days since the status changed"
// stops being an ageing signal there - a client can sit in "Investment
// executed" forever without it meaning anything.
export const SETTLED_STATUSES: BankAccountStatus[] = ['Investment executed', 'Lost'];

// 30 days without movement is the alarm threshold from the design. Always
// rendered next to the number it refers to, never as a bare colour.
export const STALLED_AFTER_DAYS = 30;

// Short labels for the funnel cards - the full "Transfer made - waiting for
// AML letter" cannot fit a 1/7-width column without wrapping to three lines.
export const STAGE_SHORT_LABELS: Record<BankAccountStatus, string> = {
  'Registered': 'Registered',
  'Onboarding': 'Onboarding',
  'Account Opened': 'Account opened',
  'Waiting for transfer': 'Waiting for transfer',
  'Transfer made - waiting for AML letter': 'Transfer made — awaiting AML',
  'AML Letter Issued': 'AML letter issued',
  'Investment executed': 'Investment executed',
  'Lost': 'Lost',
};
