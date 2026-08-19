import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBanks } from './useBanks';

export const useMyBank = () => {
  const { user } = useAuth();
  const { banks } = useBanks();
  const [bankId, setBankId] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setBankId(null); setContactName(null); return; }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('bank_id, contact_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setBankId(data?.bank_id ?? null);
        setContactName(data?.contact_name ?? null);
      });
    return () => { cancelled = true; };
  }, [user]);

  const bankName = bankId ? banks.find((b) => b.id === bankId)?.name ?? null : null;
  return { bankId, bankName, contactName };
};
