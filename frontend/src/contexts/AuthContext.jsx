/**
 * AuthContext — Supabase Auth state management
 *
 * State:
 * - user       : Supabase auth user object | null
 * - profile    : { id, email, full_name, role } | null
 * - loading    : boolean
 *
 * Actions:
 * - signUp(email, password, fullName)
 * - signIn(email, password)
 * - signOut()
 * - resetPassword(email)        — sends reset link
 * - updatePassword(newPassword)  — sets new password (after clicking reset link)
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// Remove all Supabase auth keys from both storages (fallback cleanup)
function clearSupabaseStorage() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch { /* ignore */ }
}

// Restore sessionStorage token → localStorage so Supabase can read it
// (Supabase only reads localStorage by default)
function restoreSessionToken() {
  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token') && !localStorage.getItem(key)) {
        localStorage.setItem(key, sessionStorage.getItem(key));
      }
    });
  } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile from profiles table
  const fetchProfile = useCallback(async (userId) => {
    if (!supabase) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Restore session-only token to localStorage so Supabase can read it
    restoreSessionToken();

    // Get initial session (no-op lock prevents deadlocks now)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id).then(setProfile).catch(() => {});
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Auth getSession failed:', err);
      // Clear corrupted session
      clearSupabaseStorage();
      setLoading(false);
    });

    // Subscribe to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const p = await fetchProfile(currentUser.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
      }
    );

    // If session lives only in sessionStorage, clean localStorage on tab close
    const handleUnload = () => {
      try {
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [fetchProfile]);

  // Helper: wrap Supabase call with timeout
  const withTimeout = (promise, ms = 10000) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ]);

  // Sign up — pass all fields via metadata so trigger handles profile creation
  const signUp = useCallback(async (email, password, fullName) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await withTimeout(supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    }));
    if (error) throw error;
    return data;
  }, []);

  // Sign in — remember=false ให้ session หมดเมื่อปิดแท็บ
  const signIn = useCallback(async (email, password, remember = false) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await withTimeout(supabase.auth.signInWithPassword({
      email,
      password,
    }));
    if (error) throw error;

    // ไม่ติ๊กจดจำฉัน → ย้าย token จาก localStorage ไปยัง sessionStorage
    // เพื่อให้หมดเมื่อปิดแท็บ
    if (!remember && data?.session) {
      try {
        const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
        const storageKey = `sb-${ref}-auth-token`;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          sessionStorage.setItem(storageKey, raw);
          localStorage.removeItem(storageKey);
        }
      } catch { /* ignore */ }
    }

    return data;
  }, []);

  // Reset password — sends email with reset link
  const resetPassword = useCallback(async (email) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    }));
    if (error) throw error;
  }, []);

  // Update password — called after user clicks reset link
  const updatePassword = useCallback(async (newPassword) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await withTimeout(supabase.auth.updateUser({
      password: newPassword,
    }));
    if (error) throw error;
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    // Clear local state immediately so UI responds instantly
    setUser(null);
    setProfile(null);
    if (supabase) {
      try {
        await withTimeout(supabase.auth.signOut(), 5000);
      } catch {
        // If signOut hangs or fails, manually clear Supabase localStorage keys
        clearSupabaseStorage();
      }
    }
  }, []);

  const isAdmin = profile?.role === 'admin';

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isAdmin,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  }), [user, profile, loading, isAdmin, signUp, signIn, signOut, resetPassword, updatePassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
