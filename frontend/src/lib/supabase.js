/**
 * Supabase Client — Frontend
 * ใช้ VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY จาก .env
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase env vars missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Auth & DB features disabled.'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
