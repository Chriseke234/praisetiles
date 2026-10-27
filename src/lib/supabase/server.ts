/**
 * Server-side Supabase Client for PraiseTiles Route Handlers
 * Rule version: 1.0.0
 * 
 * Never import this file into client components.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    return null;
  }

  // Prefer service role key for authorized operations; fallback to anonKey
  const keyToUse = serviceRoleKey || anonKey;
  if (!keyToUse) return null;

  return createClient(supabaseUrl, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
