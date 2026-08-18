import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  email: string | null;
  contact_name: string | null;
  bank_id: string | null;
  role: 'admin' | 'bank_staff';
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { setError('Not authenticated'); return; }

      const response = await supabase.functions.invoke('get-users', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (response.error) throw new Error(response.error.message);
      setUsers(response.data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);
  return { users, isLoading, error, refetch: fetchUsers };
};
