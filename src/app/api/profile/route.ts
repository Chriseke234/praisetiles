/**
 * GET, PATCH, and DELETE /api/profile
 * User profile management, privacy controls, and GDPR/CCPA account deletion path.
 *
 * Implements GDD Section 7 & Technical Plan Section 3:
 * - Profile visibility toggle (is_public).
 * - Display name and preferred instrument configuration.
 * - Documented data-retention deletion path: scrubs PII while retaining
 *   anonymized competitive match integrity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, createRateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimiter';

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON         = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * GET /api/profile
 * Retrieves authenticated user's profile and privacy settings.
 */
export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url, is_public, preferred_instrument, created_at, updated_at')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

/**
 * PATCH /api/profile
 * Updates permitted profile fields: displayName, isPublic, preferredInstrument.
 */
export async function PATCH(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`profile_patch:${clientIp}`, RATE_LIMIT_PRESETS.GENERAL);
  if (!rateLimit.success) {
    return createRateLimitResponse(rateLimit);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    displayName?: string;
    isPublic?: boolean;
    preferredInstrument?: 'piano' | 'guitar';
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.displayName === 'string') {
    const trimmed = body.displayName.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      return NextResponse.json(
        { error: 'Display name must be between 2 and 32 characters' },
        { status: 400 }
      );
    }
    updates.display_name = trimmed;
  }

  if (typeof body.isPublic === 'boolean') {
    updates.is_public = body.isPublic;
  }

  if (body.preferredInstrument === 'piano' || body.preferredInstrument === 'guitar') {
    updates.preferred_instrument = body.preferredInstrument;
  }

  const { data: updatedProfile, error: updateError } = await client
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, username, display_name, avatar_url, is_public, preferred_instrument, updated_at')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    message: 'Profile updated successfully',
    profile: updatedProfile,
  });
}

/**
 * DELETE /api/profile
 * Account deletion path.
 * Permanently removes user credentials and personal profile details while
 * preserving anonymized competitive history for tournament brackets.
 */
export async function DELETE(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`profile_delete:${clientIp}`, RATE_LIMIT_PRESETS.REPORT);
  if (!rateLimit.success) {
    return createRateLimitResponse(rateLimit);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const anonymizedSuffix = user.id.slice(0, 8);

  // 1. Scrub personal profile
  await adminClient
    .from('profiles')
    .update({
      display_name: 'Praiser (Deleted)',
      username: `deleted_${anonymizedSuffix}`,
      avatar_url: null,
      is_public: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // 2. Remove friend relationships and follows
  await adminClient
    .from('friendships')
    .delete()
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  await adminClient
    .from('follows')
    .delete()
    .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

  // 3. Remove active queue entries
  await adminClient
    .from('matchmaking_queue')
    .delete()
    .eq('user_id', user.id);

  // 4. Delete Supabase Auth user record
  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    return NextResponse.json(
      { error: `Account deletion partially completed: ${deleteUserError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: 'Account successfully deleted. Personal profile data scrubbed in compliance with data retention policy.',
    deletedAt: new Date().toISOString(),
  });
}
