import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // The SDK's own hash auto-detection races AuthCallbackHandler's redirect
    // to /set-password: whichever runs first wins, and when the SDK wins it
    // silently signs the invitee straight into the app with no password set
    // and no acceptance step. Handling the invite/recovery hash ourselves
    // (AuthCallbackHandler -> SetPassword) makes that deterministic instead.
    detectSessionInUrl: false,
  },
});
