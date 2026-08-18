import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BankAccountStatus } from '@/types/bankAccount';

export const useUpdateBankAccountStatus = () => {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const updateStatus = async (bankAccountId: string, newStatus: BankAccountStatus): Promise<boolean> => {
    try {
      setIsUpdating(bankAccountId);

      const { data, error } = await supabase.functions.invoke('update-bank-account-status', {
        body: { bankAccountId, newStatus },
      });

      if (error) {
        toast.error('Failed to update status');
        return false;
      }
      if (!data?.success) {
        toast.error(data?.error || 'Failed to update status');
        return false;
      }

      return true;
    } catch (err) {
      toast.error('An unexpected error occurred');
      return false;
    } finally {
      setIsUpdating(null);
    }
  };

  return { updateStatus, isUpdating };
};
