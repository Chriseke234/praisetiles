/**
 * POST /api/rooms/cleanup
 * Cleans up expired room audio from Supabase Storage.
 * Intended to be called by a Supabase Edge Function cron or a manual admin request.
 * Protected by a shared secret in the CLEANUP_SECRET env var.
 *
 * NOTE: In Phase 3 this is not automatically scheduled.
 * Set up a Supabase Edge Function or a Vercel cron job that POST /api/rooms/cleanup
 * with the Authorization: Bearer <CLEANUP_SECRET> header to periodically clean audio.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MULTIPLAYER_CONFIG } from '@/config/multiplayer';

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLEANUP_SECRET        = process.env.CLEANUP_SECRET;

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  // Fail-closed security: CLEANUP_SECRET must be configured and match the Authorization header
  if (!CLEANUP_SECRET) {
    return NextResponse.json(
      { error: 'Cleanup endpoint is disabled (CLEANUP_SECRET is not configured)' },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (provided !== CLEANUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find rooms with audio that has expired (audio_expires_at in the past)
  const { data: expiredRooms, error } = await adminClient
    .from('rooms')
    .select('id, audio_storage_path')
    .not('audio_storage_path', 'is', null)
    .lt('audio_expires_at', new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleted: string[] = [];
  const failed: string[] = [];

  for (const room of (expiredRooms ?? [])) {
    if (!room.audio_storage_path) continue;
    const { error: delErr } = await adminClient
      .storage
      .from(MULTIPLAYER_CONFIG.AUDIO.BUCKET_NAME)
      .remove([room.audio_storage_path]);

    if (delErr) {
      failed.push(room.id);
    } else {
      // Clear the path so we don't retry
      await adminClient
        .from('rooms')
        .update({ audio_storage_path: null })
        .eq('id', room.id);
      deleted.push(room.id);
    }
  }

  return NextResponse.json({ deleted: deleted.length, failed: failed.length });
}
