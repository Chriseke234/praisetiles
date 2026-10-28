/**
 * GET & POST /api/social/follow
 * Follow & Unfollow public profiles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('userId');
  if (!targetUserId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact' }).eq('following_id', targetUserId),
    supabase.from('follows').select('following_id', { count: 'exact' }).eq('follower_id', targetUserId),
  ]);

  return NextResponse.json({
    followersCount: followersRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
  });
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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { targetUserId?: string; action?: 'follow' | 'unfollow' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!body.targetUserId || body.targetUserId === user.id) {
    return NextResponse.json({ error: 'Invalid target user' }, { status: 400 });
  }

  if (body.action === 'unfollow') {
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', body.targetUserId);
    return NextResponse.json({ following: false });
  }

  // Follow
  const { error } = await supabase.from('follows').insert({
    follower_id:  user.id,
    following_id: body.targetUserId,
  });

  if (error && !error.message.includes('duplicate')) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ following: true });
}
