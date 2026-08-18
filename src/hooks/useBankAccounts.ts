import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BankAccountRecord } from '@/types/bankAccount';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const useBankAccounts = () => {
  return useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async (): Promise<BankAccountRecord[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-bank-accounts`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          await supabase.auth.signOut();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(errorData.error || 'Failed to fetch bank accounts');
      }

      const result = await response.json();
      return result.bankAccounts as BankAccountRecord[];
    },
    refetchInterval: 30000,
    retry: 2,
  });
};
