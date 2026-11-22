/**
 * Server-side Admin Authentication & Authorization Helper
 *
 * Verifies Supabase JWT and confirms the caller has `platform_admin` privileges
 * via `public.tournament_organizers` or the optional `ADMIN_EMAILS` env allowlist.
 * Keeps all backend auth logic cleanly decoupled from React UI components.
 */

import { NextRequest } from 'next/server';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export type AdminAuthResult =
  | {
      authorized: true;
      user: User;
      db: SupabaseClient;
      usingServiceRole: boolean;
    }
  | {
      authorized: false;
      status: number;
      error: string;
    };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Checks whether a given user email is explicitly listed in ADMIN_EMAILS env var.
 */
function isEmailInAllowlist(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '';
  if (!raw.trim()) return false;
  const allowlist = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

/**
 * Verifies that an incoming Next.js API request is from an authenticated `platform_admin`.
 */
export async function verifyAdminRequest(req: NextRequest): Promise<AdminAuthResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return { authorized: false, status: 503, error: 'Supabase service not configured' };
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!jwt) {
    return { authorized: false, status: 401, error: 'Authentication required' };
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return { authorized: false, status: 401, error: 'Invalid or expired session' };
  }

  // Prefer service role client for privileged admin reads/writes if configured
  const db = SUPABASE_SERVICE_ROLE
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : userClient;

  // 1. Check explicit email allowlist
  let isAdmin = isEmailInAllowlist(user.email);

  // 2. Check `tournament_organizers` table for `platform_admin` role
  if (!isAdmin) {
    const { data: orgRow, error: orgErr } = await db
      .from('tournament_organizers')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin')
      .maybeSingle();

    if (!orgErr && orgRow) {
      isAdmin = true;
    }
  }

  // 3. Check Supabase app_metadata role if set via Supabase Dashboard
  if (!isAdmin && user.app_metadata?.role === 'platform_admin') {
    isAdmin = true;
  }

  if (!isAdmin) {
    return {
      authorized: false,
      status: 403,
      error: 'Forbidden: platform_admin privileges required',
    };
  }

  return {
    authorized: true,
    user,
    db,
    usingServiceRole: Boolean(SUPABASE_SERVICE_ROLE),
  };
}
