/**
 * GET & PATCH /api/notifications
 * In-App Notification Center:
 * - GET: Fetch notifications for authenticated user
 * - PATCH: Mark notification(s) as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { InAppNotification } from '@/types/tournament';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface NotificationDbRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: InAppNotification['type'];
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ notifications: [] });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return NextResponse.json({ notifications: [] });
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, type, link_url, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications: InAppNotification[] = ((data as unknown as NotificationDbRow[]) ?? []).map((n) => ({
    id:        n.id,
    userId:    n.user_id,
    title:     n.title,
    message:   n.message,
    type:      n.type,
    linkUrl:   n.link_url ?? null,
    isRead:    n.is_read,
    createdAt: n.created_at,
  }));

  return NextResponse.json({ notifications });
}

export async function PATCH(req: NextRequest) {
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

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const body = await req.json();
  const { notificationId, markAllRead } = body;

  let query = supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);

  if (!markAllRead && notificationId) {
    query = query.eq('id', notificationId);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
