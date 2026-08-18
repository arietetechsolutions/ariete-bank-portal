import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Bank { id: string; name: string; }

export const useBanks = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { setError('Not authenticated'); return; }

      const response = await supabase.functions.invoke('get-banks', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (response.error) throw new Error(response.error.message);
      setBanks(response.data.banks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch banks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchBanks(); }, []);
  return { banks, isLoading, error, refetch: fetchBanks };
};
