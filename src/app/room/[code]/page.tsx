/**
 * /room/[code] — Private Room page
 *
 * Server component wrapper → client RoomLobby.
 * Handles: unauthenticated redirect, Supabase env check.
 */

import React, { Suspense } from 'react';
import { RoomPageClient } from './RoomPageClient';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

async function RoomPageContent({ params }: RoomPageProps) {
  const { code } = await params;
  return <RoomPageClient inviteCode={code.toUpperCase()} />;
}

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090a0f] flex items-center justify-center text-gray-400">
          Loading room…
        </div>
      }
    >
      <RoomPageContent params={params} />
    </Suspense>
  );
}

export async function generateMetadata({ params }: RoomPageProps) {
  const { code } = await params;
  return {
    title: `PraiseTiles — Room ${code}`,
    description: 'Private multiplayer gospel rhythm match',
  };
}
