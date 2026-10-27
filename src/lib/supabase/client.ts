/**
 * Browser-side Supabase Client for PraiseTiles
 * Rule version: 1.0.0
 * 
 * Includes safe detection and offline fallback so guest gameplay
 * continues working uninterrupted even if Supabase is unconfigured or offline.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | null = null;

/**
 * Checks whether valid Supabase environment credentials are configured.
 */
export function isSupabaseConfigured(): boolean {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim().length > 0 &&
    !supabaseUrl.includes('placeholder')
  );
}

/**
 * Returns a singleton instance of the browser Supabase client.
 * Returns null if Supabase credentials are not configured.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
