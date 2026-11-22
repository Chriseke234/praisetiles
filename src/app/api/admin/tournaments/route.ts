/**
 * GET & PATCH /api/admin/tournaments
 * Admin tournament oversight: lists tournaments & disputes, allows status transitions
 * and dispute resolution (uphold / reject with notes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin/auth';

const ALLOWED_TOURNAMENT_STATUSES = [
  'draft',
  'published',
  'registration_open',
  'registration_closed',
  'check_in',
  'bracket_ready',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
] as const;

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db } = auth;

  const [tournamentsRes, disputesRes] = await Promise.all([
    db
      .from('tournaments')
      .select(
        'id, title, slug, instrument, capacity, status, event_type, start_at, created_at, organizer_id'
      )
      .order('created_at', { ascending: false })
      .limit(30),
    db
      .from('tournament_disputes')
      .select(
        'id, tournament_id, match_id, filed_by_user_id, reason, description, status, resolution_notes, created_at, resolved_at'
      )
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const tournaments = (tournamentsRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    instrument: t.instrument,
    capacity: t.capacity,
    status: t.status,
    eventType: t.event_type,
    startAt: t.start_at,
    createdAt: t.created_at,
  }));

  const disputeRows = disputesRes.data ?? [];
  const filerIds = Array.from(new Set(disputeRows.map((d) => d.filed_by_user_id).filter(Boolean)));
  const profileMap: Record<string, string> = {};
  if (filerIds.length > 0) {
    const { data: profs } = await db
      .from('profiles')
      .select('id, display_name')
      .in('id', filerIds);
    for (const p of profs ?? []) {
      profileMap[p.id] = p.display_name;
    }
  }

  const tourneyTitleMap = new Map(tournaments.map((t) => [t.id, t.title]));

  const disputes = disputeRows.map((d) => ({
    id: d.id,
    tournamentId: d.tournament_id,
    tournamentTitle: tourneyTitleMap.get(d.tournament_id) ?? 'Tournament',
    matchId: d.match_id,
    filedByName: profileMap[d.filed_by_user_id] ?? 'Participant',
    reason: d.reason,
    description: d.description,
    status: d.status,
    resolutionNotes: d.resolution_notes ?? '',
    createdAt: d.created_at,
    resolvedAt: d.resolved_at,
  }));

  return NextResponse.json({ tournaments, disputes });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    action?: 'update_tournament_status' | 'resolve_dispute';
    tournamentId?: string;
    status?: string;
    disputeId?: string;
    resolution?: 'upheld' | 'rejected';
    resolutionNotes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (body.action === 'update_tournament_status') {
    if (
      !body.tournamentId ||
      !body.status ||
      !(ALLOWED_TOURNAMENT_STATUSES as readonly string[]).includes(body.status)
    ) {
      return NextResponse.json({ error: 'Invalid tournamentId or status' }, { status: 400 });
    }

    const { error } = await auth.db
      .from('tournaments')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.tournamentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (body.action === 'resolve_dispute') {
    if (
      !body.disputeId ||
      (body.resolution !== 'upheld' && body.resolution !== 'rejected')
    ) {
      return NextResponse.json({ error: 'Invalid disputeId or resolution' }, { status: 400 });
    }

    const { error } = await auth.db
      .from('tournament_disputes')
      .update({
        status: body.resolution,
        resolution_notes: (body.resolutionNotes ?? '').trim() || `Marked ${body.resolution} by platform admin`,
        resolved_by_user_id: auth.user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', body.disputeId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
