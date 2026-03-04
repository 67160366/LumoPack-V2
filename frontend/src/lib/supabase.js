/**
 * Supabase Client — Frontend
 * ใช้ VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY จาก .env
 *
 * Fix: ปิด Navigator Lock API เพื่อป้องกัน deadlock เมื่อมี stale session
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase env vars missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Auth & DB features disabled.'
  );
}

// Clean up expired/near-expired sessions BEFORE creating client
// Supabase considers tokens expiring within 90s as needing refresh,
// which triggers a network call that can hang → deadlock with Navigator Locks
if (supabaseUrl) {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    const storageKey = `sb-${ref}-auth-token`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const session = JSON.parse(raw);
      const expiresAt = session?.expires_at; // unix seconds
      // Remove if expired or expiring within 2 minutes (120s margin)
      if (expiresAt && expiresAt < Date.now() / 1000 + 120) {
        console.warn('Removing expired/stale Supabase session');
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}-user`);
      }
    }
  } catch { /* ignore */ }
}

// No-op lock function — bypasses Navigator Locks API to prevent deadlocks
const noopLock = async (_name, _acquireTimeout, fn) => fn();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        lock: noopLock, // Prevent Navigator Lock deadlocks
      },
    })
  : null;
