/**
 * Browser-side Supabase Client for PraiseTiles
 * Rule version: 1.1.0
 * 
 * Includes safe detection and offline fallback so guest gameplay
 * continues working uninterrupted even if Supabase is unconfigured or offline.
 * 
 * NOTE: Credentials are read dynamically at call time (not module load time) so
 * unit tests can safely clear env vars in beforeEach and get correct behaviour.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/** Returns the current Supabase URL from the environment. */
function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Returns the current Supabase anon key from the environment. */
function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * Checks whether valid Supabase environment credentials are configured.
 * Reads process.env at call time so test isolation with beforeEach works correctly.
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return (
    typeof url === 'string' &&
    url.trim().length > 0 &&
    typeof key === 'string' &&
    key.trim().length > 0 &&
    !url.includes('placeholder')
  );
}

/**
 * Returns a singleton instance of the browser Supabase client.
 * Returns null if Supabase credentials are not configured.
 * Invalidates the cached singleton when credentials change (supports test isolation).
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    // Clear any stale cached client so reconfiguring in tests works
    browserClient = null;
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(getSupabaseUrl()!, getSupabaseAnonKey()!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
