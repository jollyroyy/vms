// Supabase typed client — single instance for the whole app.
// URL and anon key come from Vite env vars (.env file, never committed — SEC-4).
// The anon key is public-safe; the service role key NEVER lives in client code.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/index';

const url     = import.meta.env.VITE_SUPABASE_URL     ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!url || !anonKey) {
  // Fail fast in dev so the developer knows to set up .env
  console.error('[VMS] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example → .env and fill in your Supabase project values.');
}

export const supabase = createClient<Database>(url, anonKey);
