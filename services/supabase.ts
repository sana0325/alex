import { createClient } from '@supabase/supabase-js';

// NOTE: In a real deployment, these should be environment variables.
// For this generated code to run immediately without env setup, we handle missing keys gracefully in the UI.
const envUrl = process.env.VITE_SUPABASE_URL;
const envKey = process.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = () => {
  return typeof envUrl === 'string' && envUrl.length > 0 && typeof envKey === 'string' && envKey.length > 0;
};

// Fallback values to allow the client to initialize without throwing "supabaseUrl is required".
// The app prevents actual usage via isSupabaseConfigured().
const url = isSupabaseConfigured() ? envUrl! : 'https://placeholder.supabase.co';
const key = isSupabaseConfigured() ? envKey! : 'placeholder';

export const supabase = createClient(url, key);