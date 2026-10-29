/**
 * Runtime Environment Configuration Validator
 *
 * Verifies that critical environment variables exist and conform to valid formats,
 * without logging or leaking raw secret values.
 */

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Critical public variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  } else {
    try {
      const parsed = new URL(supabaseUrl);
      if (!parsed.protocol.startsWith('http')) {
        warnings.push('NEXT_PUBLIC_SUPABASE_URL should use http/https protocol');
      }
    } catch {
      warnings.push('NEXT_PUBLIC_SUPABASE_URL is not a valid URL');
    }
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  } else if (anonKey.length < 20) {
    warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY seems unexpectedly short');
  }

  // Server-only variables
  if (typeof window === 'undefined') {
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY is not set (server admin functions will be restricted)');
    }

    const cleanupSecret = process.env.CLEANUP_SECRET;
    if (!cleanupSecret) {
      warnings.push('CLEANUP_SECRET is not set (audio cleanup cron endpoint will reject requests)');
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}
