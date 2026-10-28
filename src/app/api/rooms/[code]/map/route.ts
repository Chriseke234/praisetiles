/**
 * POST /api/rooms/[code]/map
 * Host-only. Validates the submitted RhythmMap and stores it in room_matches.
 * Returns match_id and scheduled_start_at for synchronized gameplay.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SubmitMapRequest, SubmitMapResponse } from '@/types/room';
import { RhythmMap } from '@/types/game';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Validate map structure server-side before storing in DB. */
function validateMapStructure(map: unknown): map is RhythmMap {
  if (!map || typeof map !== 'object') return false;
  const m = map as Record<string, unknown>;
  if (typeof m.version !== 'string') return false;
  if (typeof m.duration !== 'number' || m.duration <= 0) return false;
  if (typeof m.totalNotes !== 'number') return false;
  if (!Array.isArray(m.notes)) return false;
  if (typeof m.audioFingerprint !== 'string') return false;
  if (!m.stages || typeof m.stages !== 'object') return false;

  // Validate a sample of notes for structure
  const sampleSize = Math.min(m.notes.length, 10);
  for (let i = 0; i < sampleSize; i++) {
    const note = m.notes[i] as Record<string, unknown>;
    if (typeof note.id !== 'string') return false;
    if (typeof note.time !== 'number' || note.time < 0) return false;
    if (typeof note.lane !== 'number' || note.lane < 0 || note.lane > 3) return false;
  }
  return true;
}

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: SubmitMapRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Server-side map validation
  if (!validateMapStructure(body.mapJson)) {
    return NextResponse.json(
      { error: 'Invalid rhythm map: missing or malformed required fields (version, duration, notes, audioFingerprint, stages)' },
      { status: 422 }
    );
  }

  if (!body.checksum || typeof body.checksum !== 'string') {
    return NextResponse.json({ error: 'Missing map checksum' }, { status: 422 });
  }

  // Resolve room from invite code (needed to pass room_id to the RPC)
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, host_id')
    .eq('invite_code', code.toUpperCase())
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  // Delegate to the SECURITY DEFINER function (validates host, seeds match_participants, etc.)
  const { data, error } = await supabase.rpc('submit_map', {
    p_room_id:          room.id,
    p_map_json:         body.mapJson as unknown as Record<string, unknown>,
    p_checksum:         body.checksum,
    p_song_title:       body.songTitle ?? body.mapJson.songTitle ?? 'Untitled',
    p_song_fingerprint: body.songFingerprint ?? body.mapJson.audioFingerprint,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = data as { match_id: string; scheduled_start_at: string };

  const response: SubmitMapResponse = {
    matchId:          result.match_id,
    scheduledStartAt: result.scheduled_start_at,
  };

  return NextResponse.json(response, { status: 200 });
}
