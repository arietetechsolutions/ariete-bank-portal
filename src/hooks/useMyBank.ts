import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useMyBank = () => {
  const { user } = useAuth();
  const [bankId, setBankId] = useState<string | null>(null);
  const [bankName, setBankName] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setBankId(null); setBankName(null); setContactName(null); return; }
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('bank_id, contact_name')
          .eq('id', user.id)
          .single();
        if (cancelled) return;
        setBankId(profileData?.bank_id ?? null);
        setContactName(profileData?.contact_name ?? null);

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;

        const response = await supabase.functions.invoke('get-my-bank', {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        if (cancelled) return;
        if (!response.error) setBankName(response.data?.bank?.name ?? null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load profile bank/name:', err);
      }
    };

    loadProfile();
    return () => { cancelled = true; };
  }, [user]);

  return { bankId, bankName, contactName };
};
