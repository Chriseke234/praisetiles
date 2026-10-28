/**
 * POST /api/tournaments/[id]/checkin
 * Idempotent check-in for registered tournament participant
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

  // Call RPC
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('check_in_tournament_participant', {
    p_tournament_id: id,
  });

  if (rpcErr) {
    // Fallback direct check-in update
    const { error: updErr } = await supabase
      .from('tournament_participants')
      .update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
      })
      .eq('tournament_id', id)
      .eq('user_id', user.id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Checked in successfully' });
  }

  if (!rpcRes.success) {
    return NextResponse.json({ error: rpcRes.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, checkedInAt: rpcRes.checkedInAt });
}
