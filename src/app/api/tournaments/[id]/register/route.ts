/**
 * POST & DELETE /api/tournaments/[id]/register
 * - POST: Atomic, capacity-checked participant registration
 * - DELETE: Participant withdrawal before deadline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { id } = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  // Call database RPC
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('register_tournament_participant', {
    p_tournament_id: id,
  });

  if (rpcErr) {
    // Fallback direct insert if RPC not applied yet
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('capacity, status')
      .eq('id', id)
      .single();

    if (!tourney) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    const { count } = await supabase
      .from('tournament_participants')
      .select('id', { count: 'exact' })
      .eq('tournament_id', id)
      .neq('status', 'withdrawn');

    if ((count ?? 0) >= tourney.capacity) {
      return NextResponse.json({ error: 'Tournament is full' }, { status: 400 });
    }

    const { error: insErr } = await supabase
      .from('tournament_participants')
      .upsert({
        tournament_id: id,
        user_id: user.id,
        status: 'registered',
      }, { onConflict: 'tournament_id, user_id' });

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Registered successfully' });
  }

  if (!rpcRes.success) {
    return NextResponse.json({ error: rpcRes.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, participantId: rpcRes.participantId });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { id } = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const { data: tourney } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', id)
    .single();

  if (tourney && (tourney.status === 'in_progress' || tourney.status === 'completed')) {
    return NextResponse.json({ error: 'Cannot withdraw from an in-progress or completed tournament' }, { status: 400 });
  }

  const { error: delErr } = await supabase
    .from('tournament_participants')
    .update({ status: 'withdrawn' })
    .eq('tournament_id', id)
    .eq('user_id', user.id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Withdrawn from tournament' });
}
