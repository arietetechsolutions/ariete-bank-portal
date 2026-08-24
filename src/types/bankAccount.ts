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
  created_at: string;
}
