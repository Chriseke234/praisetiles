/**
 * POST /api/rooms/[code]/upload
 * Host-only. Returns a short-lived signed upload URL for the room's audio file.
 * The actual audio bytes are uploaded directly from the browser to Supabase Storage
 * using this signed URL — the service-role key never reaches the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MULTIPLAYER_CONFIG } from '@/config/multiplayer';

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON         = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Verify caller is host using the user JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve room_id from invite code
  const { data: room, error: roomErr } = await userClient
    .from('rooms')
    .select('id, host_id, status')
    .eq('invite_code', code.toUpperCase())
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  // Verify caller identity
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user || user.id !== room.host_id) {
    return NextResponse.json({ error: 'Only the room host can upload audio' }, { status: 403 });
  }

  if (!['waiting', 'voting', 'uploading'].includes(room.status)) {
    return NextResponse.json(
      { error: `Room cannot accept audio in current state: ${room.status}` },
      { status: 409 }
    );
  }

  let body: { fileName?: string; matchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const ext = (body.fileName ?? 'audio').split('.').pop()?.toLowerCase() ?? 'mp3';
  const safeExt = ['mp3', 'wav', 'mp4', 'aac', 'ogg', 'm4a'].includes(ext) ? ext : 'mp3';
  const matchId = body.matchId ?? 'pending';
  const objectPath = `rooms/${room.id}/${matchId}/audio.${safeExt}`;

  // Use service role to create signed upload URL (service key stays server-side)
  const serviceKey = SUPABASE_SERVICE_ROLE || SUPABASE_ANON;
  const adminClient = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signedData, error: signErr } = await adminClient
    .storage
    .from(MULTIPLAYER_CONFIG.AUDIO.BUCKET_NAME)
    .createSignedUploadUrl(objectPath);

  if (signErr) {
    return NextResponse.json({ error: 'Could not create upload URL: ' + signErr.message }, { status: 500 });
  }

  // Update room status to 'uploading'
  await userClient
    .from('rooms')
    .update({ status: 'uploading', audio_storage_path: objectPath })
    .eq('id', room.id);

  return NextResponse.json({
    signedUrl:  signedData.signedUrl,
    objectPath,
    token:      signedData.token,
  });
}
