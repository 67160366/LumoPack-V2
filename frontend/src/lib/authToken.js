import { supabase } from './supabase';

/**
 * Returns a valid access token, refreshing the session if needed.
 */
export async function getFreshAccessToken() {
  if (!supabase) return null;
  const { data: first } = await supabase.auth.getSession();
  if (first.session?.access_token) return first.session.access_token;
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) return null;
  return data.session.access_token;
}
