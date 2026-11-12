import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AnimatedVinyl,
  RhythmTilesMiniature,
  ArenaProgressBar,
  ArenaLoadingScreen,
  LibrarySkeletonLoader,
  MultiplayerLoadingOverlay,
  TournamentSkeletonLoader,
} from '@/components/loading';

describe('Premium Loading Screen Suite', () => {
  describe('AnimatedVinyl Component', () => {
    it('renders the SVG vinyl record with accessible label', () => {
      const html = renderToStaticMarkup(<AnimatedVinyl size="md" isSpinning={true} />);
      expect(html).toContain('<svg');
      expect(html).toContain('aria-label="PraiseTiles Animated Vinyl Record"');
    });

    it('applies rotation animation class when spinning and reducedMotion is false', () => {
      const html = renderToStaticMarkup(<AnimatedVinyl isSpinning={true} reducedMotion={false} />);
      expect(html).toContain('animate-[spin_7s_linear_infinite]');
    });

    it('disables rotational animation when reducedMotion is true', () => {
      const html = renderToStaticMarkup(<AnimatedVinyl isSpinning={true} reducedMotion={true} />);
      expect(html).not.toContain('animate-[spin_7s_linear_infinite]');
    });

    it('renders concentric groove paths and sanctuary gold center label', () => {
      const html = renderToStaticMarkup(<AnimatedVinyl size="lg" />);
      // Checks for circular groove definitions and center label
      expect(html).toContain('id="vinylBody"');
      expect(html).toContain('id="centerLabel"');
      expect(html).toContain('cx="150" cy="150"');
    });
  });

  describe('RhythmTilesMiniature Component', () => {
    it('renders all 4 lanes in full mode', () => {
      const html = renderToStaticMarkup(<RhythmTilesMiniature mode="full" height={200} />);
      expect(html).toContain('border-purple-500/30');
      expect(html).toContain('border-violet-500/30');
      expect(html).toContain('border-amber-500/30');
      expect(html).toContain('border-rose-500/30');
    });

    it('renders left-pair lanes in left-pair mode for flanked soundstage', () => {
      const html = renderToStaticMarkup(<RhythmTilesMiniature mode="left-pair" height={180} />);
      expect(html).toContain('border-purple-500/30');
      expect(html).toContain('border-violet-500/30');
      expect(html).not.toContain('border-rose-500/30');
    });

    it('renders right-pair lanes in right-pair mode for flanked soundstage', () => {
      const html = renderToStaticMarkup(<RhythmTilesMiniature mode="right-pair" height={180} />);
      expect(html).toContain('border-amber-500/30');
      expect(html).toContain('border-rose-500/30');
      expect(html).not.toContain('border-purple-500/30');
    });

    it('includes illuminated strike / judgment line', () => {
      const html = renderToStaticMarkup(<RhythmTilesMiniature mode="full" />);
      expect(html).toContain('bg-gradient-to-r from-purple-500 via-amber-400 to-rose-500');
    });
  });

  describe('ArenaProgressBar Component', () => {
    it('displays exact percentage and width when progress is measurable', () => {
      const html = renderToStaticMarkup(
        <ArenaProgressBar
          progress={68}
          statusText="Decoding Audio Buffers"
          substatusText="4-lane analysis"
          showPercentage={true}
        />
      );

      expect(html).toContain('68%');
      expect(html).toContain('style="width:68%"');
      expect(html).toContain('Decoding Audio Buffers');
      expect(html).toContain('4-lane analysis');
    });

    it('uses honest indeterminate mode when progress is undefined (no fabricated percentage)', () => {
      const html = renderToStaticMarkup(
        <ArenaProgressBar
          statusText="Connecting to Soundstage"
          substatusText="Waiting for Web Audio"
        />
      );

      // Must not render any numeric percentage text
      expect(html).not.toMatch(/>\d+%/);
      expect(html).toContain('animate-[indeterminateSweep_1.6s_ease-in-out_infinite]');
      expect(html).toContain('Connecting to Soundstage');
      expect(html).toContain('Waiting for Web Audio');
    });

    it('clamps negative or exceeding progress percentages between 0 and 100', () => {
      const clampedHigh = renderToStaticMarkup(<ArenaProgressBar progress={150} />);
      expect(clampedHigh).toContain('100%');
      expect(clampedHigh).toContain('style="width:100%"');

      const clampedLow = renderToStaticMarkup(<ArenaProgressBar progress={-20} />);
      expect(clampedLow).toContain('0%');
      expect(clampedLow).toContain('style="width:0%"');
    });
  });

  describe('ArenaLoadingScreen Component', () => {
    it('renders title, subtitle, mode badge, and vinyl soundstage', () => {
      const html = renderToStaticMarkup(
        <ArenaLoadingScreen
          title="Way Maker"
          subtitle="Preparing your performance..."
          mode="piano"
          statusText="Tuning the arena..."
        />
      );

      expect(html).toContain('Way Maker');
      expect(html).toContain('Preparing your performance...');
      expect(html).toContain('Piano Tiles Arena');
      expect(html).toContain('Tuning the arena...');
      expect(html).toContain('aria-label="PraiseTiles Animated Vinyl Record"');
    });

    it('renders guitar tiles arena badge when guitar mode is specified', () => {
      const html = renderToStaticMarkup(
        <ArenaLoadingScreen
          title="Goodness of God"
          mode="guitar"
        />
      );

      expect(html).toContain('Guitar Tiles Arena');
      expect(html).toContain('Goodness of God');
    });
  });

  describe('LibrarySkeletonLoader Component', () => {
    it('renders the requested number of music skeleton cards', () => {
      const html = renderToStaticMarkup(
        <LibrarySkeletonLoader count={4} message="Searching gospel streaming catalog..." />
      );

      expect(html).toContain('Searching gospel streaming catalog...');
      const matchCards = html.match(/bg-\[\#130f24\]\/70/g);
      expect(matchCards?.length).toBe(4);
    });

    it('renders 4 equalizer bars', () => {
      const html = renderToStaticMarkup(<LibrarySkeletonLoader />);
      const eqMatches = html.match(/from-purple-500 to-amber-400/g);
      expect(eqMatches?.length).toBe(4);
    });
  });

  describe('MultiplayerLoadingOverlay Component', () => {
    it('renders room PIN and occupied player slot indicators', () => {
      const html = renderToStaticMarkup(
        <MultiplayerLoadingOverlay
          roomCode="PRAISE7"
          connectedCount={2}
          maxPlayers={4}
          stage="syncing"
        />
      );

      expect(html).toContain('ROOM PIN: PRAISE7');
      expect(html).toContain('Players in Lobby: 2 / 4');
      expect(html).toContain('Synchronising player clocks &amp; telemetry...');
      expect(html).toContain('Ready');
      expect(html).toContain('Waiting');
    });
  });

  describe('TournamentSkeletonLoader Component', () => {
    it('renders all tournament stage bracket sections', () => {
      const html = renderToStaticMarkup(<TournamentSkeletonLoader />);

      expect(html).toContain('Preparing Championship Tournament');
      expect(html).toContain('Quarterfinals');
      expect(html).toContain('Semifinals');
      expect(html).toContain('Championship');
      expect(html).toContain('Grand Finals');
    });
  });
});
