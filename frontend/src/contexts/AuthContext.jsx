/**
 * AuthContext — Supabase Auth state management
 *
 * State:
 * - user       : Supabase auth user object | null
 * - profile    : { id, full_name, phone, company, role } | null
 * - loading    : boolean
 *
 * Actions:
 * - signUp(email, password, fullName, phone, company)
 * - signIn(email, password)
 * - signOut()
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// Remove all Supabase auth keys from localStorage (fallback cleanup)
function clearSupabaseStorage() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
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

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Helper: wrap Supabase call with timeout
  const withTimeout = (promise, ms = 10000) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ]);

  // Sign up
  const signUp = useCallback(async (email, password, fullName, phone, company) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await withTimeout(supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    }));
    if (error) throw error;

    // Update profile with phone & company (trigger auto-creates row)
    if (data.user) {
      await withTimeout(supabase
        .from('profiles')
        .update({ phone, company, full_name: fullName })
        .eq('id', data.user.id));
    }

    return data;
  }, []);

  // Sign in
  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await withTimeout(supabase.auth.signInWithPassword({
      email,
      password,
    }));
    if (error) throw error;
    return data;
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
  }), [user, profile, loading, isAdmin, signUp, signIn, signOut]);

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
