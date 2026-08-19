import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBanks } from './useBanks';

export const useMyBank = () => {
  const { user } = useAuth();
  const { banks } = useBanks();
  const [bankId, setBankId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setBankId(null); return; }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('bank_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (!cancelled) setBankId(data?.bank_id ?? null); });
    return () => { cancelled = true; };
  }, [user]);

  const bankName = bankId ? banks.find((b) => b.id === bankId)?.name ?? null : null;
  return { bankId, bankName };
};
