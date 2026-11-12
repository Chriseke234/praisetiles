'use client';

/**
 * Root Loading Experience for PraiseTiles
 * Automatically displayed by Next.js App Router during route transitions and chunk downloads.
 */

import React from 'react';
import { ArenaLoadingScreen } from '@/components/loading/ArenaLoadingScreen';

export default function RootLoading() {
  return (
    <ArenaLoadingScreen
      title="Entering the Arena"
      subtitle="Connecting to the PraiseTiles Gospel Soundstage"
      mascotPose="welcoming"
      statusText="Warming up the instruments..."
      substatusText="Synchronising Web Audio and 4-lane engines"
    />
  );
}
