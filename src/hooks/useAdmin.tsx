import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AdminContextValue { isAdmin: boolean; isLoading: boolean; }

const AdminContext = createContext<AdminContextValue>({ isAdmin: false, isLoading: true });

// Resolved once per session here, instead of every component that needs it
// re-running its own auth-then-role round trip independently - that was
// what made the admin-only nav item visibly pop in late on every navigation.
export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAdminRole = async () => {
      if (authLoading) { setIsLoading(true); return; }
      if (!user) { setIsAdmin(false); setIsLoading(false); return; }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role', 'admin');

        if (cancelled) return;
        if (error) { console.error('Error checking admin role:', error); setIsAdmin(false); }
        else { setIsAdmin((data?.length ?? 0) > 0); }
      } catch (err) {
        if (cancelled) return;
        console.error('Error in useAdmin:', err);
        setIsAdmin(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkAdminRole();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return <AdminContext.Provider value={{ isAdmin, isLoading }}>{children}</AdminContext.Provider>;
};

export const useAdmin = () => useContext(AdminContext);
