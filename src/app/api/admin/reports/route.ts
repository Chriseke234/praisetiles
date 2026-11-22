/**
 * GET & DELETE /api/admin/reports
 * Retrieves player conduct reports (`user_reports`) and allows admins to dismiss/resolve them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db } = auth;
  const { data: reports, error } = await db
    .from('user_reports')
    .select('id, reporter_id, reported_id, reason, details, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ reports: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = reports ?? [];
  const userIds = Array.from(
    new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id]).filter(Boolean))
  );

  const profileMap: Record<string, { username: string; display_name: string }> = {};
  if (userIds.length > 0) {
    const { data: profs } = await db
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds);
    for (const p of profs ?? []) {
      profileMap[p.id] = { username: p.username, display_name: p.display_name };
    }
  }

  const enriched = rows.map((r) => ({
    id: r.id,
    reporterId: r.reporter_id,
    reporterName: profileMap[r.reporter_id]?.display_name ?? 'Unknown',
    reportedId: r.reported_id,
    reportedName: profileMap[r.reported_id]?.display_name ?? 'Unknown',
    reportedUsername: profileMap[r.reported_id]?.username ?? 'unknown',
    reason: r.reason,
    details: r.details ?? '',
    createdAt: r.created_at,
  }));

  return NextResponse.json({ reports: enriched });
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const reportId = searchParams.get('id');
  if (!reportId) {
    return NextResponse.json({ error: 'Report id is required' }, { status: 400 });
  }

  const { error } = await auth.db.from('user_reports').delete().eq('id', reportId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
