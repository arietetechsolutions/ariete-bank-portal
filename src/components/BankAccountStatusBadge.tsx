import { Badge } from '@/components/ui/badge';
import { BankAccountStatus } from '@/types/bankAccount';

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  'Registered': { variant: 'secondary' },
  'Onboarding': { variant: 'secondary' },
  'Account Opened': { variant: 'default' },
  'Waiting for transfer': { variant: 'warning' as 'default' },
  'Transfer made - waiting for AML letter': { variant: 'warning' as 'default' },
  'AML Letter Issued': { variant: 'success' as 'default' },
  'Investment executed': { variant: 'success' as 'default' },
  'Lost': { variant: 'destructive' as 'default' },
};

const BankAccountStatusBadge = ({ status }: { status: BankAccountStatus | '' }) => {
  const config = statusConfig[status] || { variant: 'outline' as const };
  return <Badge variant={config.variant as never}>{status || '-'}</Badge>;
};

export default BankAccountStatusBadge;
