/**
 * GET & POST /api/social/invite
 * Send, view, and respond to room invitations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RoomInvitation } from '@/types/social';
import { InstrumentType } from '@/types/game';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('room_invitations')
    .select(`
      id, sender_id, receiver_id, room_id, invite_code, status, created_at, expires_at,
      sender:sender_id (display_name, avatar_url),
      room:room_id (name, room_mode, instrument)
    `)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  interface InviteDbRow {
    id: string;
    sender_id: string;
    receiver_id: string;
    room_id: string;
    invite_code: string;
    status: RoomInvitation['status'];
    created_at: string;
    expires_at: string;
    sender?: {
      display_name?: string;
      avatar_url?: string | null;
    } | null;
    room?: {
      name?: string;
      room_mode?: 'casual' | 'ranked';
      instrument?: string;
    } | null;
  }

  const invites: RoomInvitation[] = ((data as unknown as InviteDbRow[]) ?? []).map((row) => ({
    id:                row.id,
    senderId:          row.sender_id,
    senderDisplayName: row.sender?.display_name ?? 'Player',
    senderAvatarUrl:   row.sender?.avatar_url ?? null,
    receiverId:        row.receiver_id,
    roomId:            row.room_id,
    roomName:          row.room?.name ?? 'Private Room',
    inviteCode:        row.invite_code,
    roomMode:          row.room?.room_mode ?? 'casual',
    instrument:        (row.room?.instrument ?? 'piano') as InstrumentType,
    status:            row.status,
    createdAt:         row.created_at,
    expiresAt:         row.expires_at,
  }));

  return NextResponse.json({ invitations: invites });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    action: 'send' | 'accept' | 'decline';
    receiverId?: string;
    roomId?: string;
    inviteCode?: string;
    invitationId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // 1. Send invite
  if (body.action === 'send' && body.receiverId && body.roomId && body.inviteCode) {
    // Check if blocked
    const { data: blocked } = await supabase
      .from('user_blocks')
      .select('*')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${body.receiverId}),and(blocker_id.eq.${body.receiverId},blocked_id.eq.${user.id})`)
      .limit(1);

    if (blocked && blocked.length > 0) {
      return NextResponse.json({ error: 'Cannot send invitation' }, { status: 403 });
    }

    const { error: insErr } = await supabase.from('room_invitations').insert({
      sender_id:   user.id,
      receiver_id: body.receiverId,
      room_id:     body.roomId,
      invite_code: body.inviteCode.toUpperCase(),
      status:      'pending',
    });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  // 2. Accept / Decline
  if ((body.action === 'accept' || body.action === 'decline') && body.invitationId) {
    const newStatus = body.action === 'accept' ? 'accepted' : 'declined';
    const { error: updErr } = await supabase
      .from('room_invitations')
      .update({ status: newStatus })
      .eq('id', body.invitationId)
      .eq('receiver_id', user.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, status: newStatus });
  }

  return NextResponse.json({ error: 'Invalid invitation request' }, { status: 400 });
}
