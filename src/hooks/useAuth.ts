import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // getSession() only reads the token cached in localStorage - it never
    // confirms the account still exists. A deleted user's not-yet-expired
    // access token would otherwise keep rendering the app shell (edge
    // functions reject it via their own getUser() check, but the frontend
    // gate never asked). getUser() round-trips to the Auth server and fails
    // the moment the account is gone, so we drop the stale session locally
    // instead of trusting it.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setSession(null); setUser(null); setLoading(false); return; }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  // Read from app_metadata, never user_metadata: user_metadata is writable by
  // the user via auth.updateUser(), so a gate built on it could be flipped
  // open by the very person it is meant to stop. app_metadata is
  // service-role-only, and useAuth resolves `user` through getUser(), which
  // round-trips to the Auth server - so this reflects the current truth rather
  // than whatever a possibly-stale cached JWT claims.
  const passwordSet = user?.app_metadata?.password_set === true;

  return { user, session, loading, passwordSet, signIn, signOut };
};
