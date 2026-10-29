/**
 * GET & POST /api/social/friends
 * Manage friend lists, pending incoming/outgoing requests, accept/reject/remove.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Friendship } from '@/types/social';
import { checkRateLimit, createRateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimiter';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all friendships where current user is user_id or friend_id
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id, user_id, friend_id, status, created_at,
      u:user_id (id, username, display_name, avatar_url, player_progress(gem_rank)),
      f:friend_id (id, username, display_name, avatar_url, player_progress(gem_rank))
    `)
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  interface FriendUserPart {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
    player_progress?: { gem_rank: string }[];
  }

  interface FriendshipDbRow {
    id: string;
    user_id: string;
    friend_id: string;
    status: Friendship['status'];
    created_at: string;
    u?: FriendUserPart | null;
    f?: FriendUserPart | null;
  }

  const friendships: Friendship[] = ((data as unknown as FriendshipDbRow[]) ?? []).map((row) => {
    const isRequester = row.user_id === user.id;
    const otherProfile = isRequester ? row.f : row.u;

    return {
      id:                      row.id,
      userId:                  user.id,
      friendId:                isRequester ? row.friend_id : row.user_id,
      friendDisplayName:       otherProfile?.display_name ?? 'Player',
      friendUsername:          otherProfile?.username ?? 'player',
      friendAvatarUrl:         otherProfile?.avatar_url ?? null,
      friendGemRank:           otherProfile?.player_progress?.[0]?.gem_rank ?? 'Quartz',
      friendCompetitiveRating: 1000,
      isOnline:                true,
      status:                  row.status,
      isRequester,
      createdAt:               row.created_at,
    };
  });

  return NextResponse.json({ friendships });
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`friends:${clientIp}`, RATE_LIMIT_PRESETS.SOCIAL);
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    action: 'request' | 'accept' | 'reject' | 'remove';
    targetUserId?: string;
    friendshipId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // 1. Send Request
  if (body.action === 'request' && body.targetUserId) {
    if (body.targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 });
    }

    // Check if blocked
    const { data: blocked } = await supabase
      .from('user_blocks')
      .select('*')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${body.targetUserId}),and(blocker_id.eq.${body.targetUserId},blocked_id.eq.${user.id})`)
      .limit(1);

    if (blocked && blocked.length > 0) {
      return NextResponse.json({ error: 'Cannot send request' }, { status: 403 });
    }

    const { error: insErr } = await supabase.from('friendships').insert({
      user_id:   user.id,
      friend_id: body.targetUserId,
      status:    'pending',
    });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Friend request sent' });
  }

  // 2. Accept Request
  if (body.action === 'accept' && body.friendshipId) {
    const { error: updErr } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', body.friendshipId)
      .eq('friend_id', user.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  // 3. Reject or Cancel Request
  if (body.action === 'reject' && body.friendshipId) {
    const { error: delErr } = await supabase
      .from('friendships')
      .delete()
      .eq('id', body.friendshipId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  // 4. Remove Friend
  if (body.action === 'remove' && body.targetUserId) {
    const { error: delErr } = await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${body.targetUserId}),and(user_id.eq.${body.targetUserId},friend_id.eq.${user.id})`);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
