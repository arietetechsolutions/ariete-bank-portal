export type BankAccountStatus =
  | 'Onboarding'
  | 'Account Opened'
  | 'Waiting for transfer'
  | 'Transfer made - waiting for AML letter'
  | 'AML Letter Issued';

export const BANK_ACCOUNT_STATUSES: BankAccountStatus[] = [
  'Onboarding',
  'Account Opened',
  'Waiting for transfer',
  'Transfer made - waiting for AML letter',
  'AML Letter Issued',
];

export interface BankAccountRecord {
  id: string;
  client_name: string;
  email: string;
  status: BankAccountStatus | '';
  created_at: string;
}
