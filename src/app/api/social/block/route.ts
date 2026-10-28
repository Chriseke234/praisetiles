/**
 * GET & POST /api/social/block
 * Block and unblock users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_blocks')
    .select(`
      blocker_id, blocked_id, created_at,
      p:blocked_id (id, username, display_name, avatar_url)
    `)
    .eq('blocker_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  interface BlockDbRow {
    blocker_id: string;
    blocked_id: string;
    created_at: string;
    p?: {
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string | null;
    } | null;
  }

  const blocks = ((data as unknown as BlockDbRow[]) ?? []).map((row) => ({
    blockerId:          row.blocker_id,
    blockedId:          row.blocked_id,
    blockedDisplayName: row.p?.display_name ?? 'Player',
    blockedUsername:    row.p?.username ?? 'player',
    blockedAvatarUrl:   row.p?.avatar_url ?? null,
    createdAt:          row.created_at,
  }));

  return NextResponse.json({ blocks });
}

export async function POST(req: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { targetUserId?: string; action?: 'block' | 'unblock' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!body.targetUserId || body.targetUserId === user.id) {
    return NextResponse.json({ error: 'Invalid target user' }, { status: 400 });
  }

  if (body.action === 'unblock') {
    await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', body.targetUserId);
    return NextResponse.json({ blocked: false });
  }

  // Block
  await supabase.from('user_blocks').insert({
    blocker_id: user.id,
    blocked_id: body.targetUserId,
  });

  // Also remove mutual friendship if exists
  await supabase
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${user.id},friend_id.eq.${body.targetUserId}),and(user_id.eq.${body.targetUserId},friend_id.eq.${user.id})`);

  return NextResponse.json({ blocked: true });
}
