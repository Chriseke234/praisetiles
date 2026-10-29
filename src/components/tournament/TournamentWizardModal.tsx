'use client';

/**
 * TournamentWizardModal — Multi-step Tournament Creation Wizard.
 * Available to platform administrators and approved tournament organizers.
 * Strictly validates chronological timeline and tournament configuration before publication.
 */

import React, { useState } from 'react';
import {
  Trophy, X, Check,
  AlertTriangle, Loader2, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { InstrumentType } from '@/types/game';
import { RoomMode } from '@/types/social';
import { TournamentCapacity, SongSelectionPolicy, TOURNAMENT_CONFIG } from '@/config/tournament';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface TournamentWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_COVER_IMAGES = [
  { label: 'Gospel Keys Stage', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Worship Concert Arena', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Acoustic Praise Lights', url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Praise Arena Ambiance', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80' },
];

export const TournamentWizardModal: React.FC<TournamentWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic Info
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState(DEFAULT_COVER_IMAGES[0].url);
  const [eventType, setEventType]     = useState<'official' | 'community'>('official');

  // Step 2: Format & Rules
  const [instrument, setInstrument]   = useState<InstrumentType>('piano');
  const [capacity, setCapacity]       = useState<TournamentCapacity>(8);
  const [roomMode, setRoomMode]       = useState<RoomMode>('ranked');
  const [songPolicy, setSongPolicy]   = useState<SongSelectionPolicy>('approved_pool');
  const [rulesText, setRulesText]     = useState('');

  // Step 3: Chronological Schedule
  const now = new Date();
  const plusHours = (h: number) => new Date(now.getTime() + h * 3600000).toISOString().slice(0, 16);

  const [registrationStartAt, setRegistrationStartAt] = useState(plusHours(1));
  const [registrationEndAt, setRegistrationEndAt]     = useState(plusHours(24));
  const [checkInStartAt, setCheckInStartAt]           = useState(plusHours(24));
  const [checkInEndAt, setCheckInEndAt]               = useState(plusHours(25));
  const [startAt, setStartAt]                         = useState(plusHours(25.5));

  if (!isOpen) return null;

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!title.trim()) { setError('Tournament title is required'); return; }
    } else if (step === 3) {
      // Validate chronological order
      const regStart  = new Date(registrationStartAt).getTime();
      const regEnd    = new Date(registrationEndAt).getTime();
      const cInStart  = new Date(checkInStartAt).getTime();
      const cInEnd    = new Date(checkInEndAt).getTime();
      const tourneyStart = new Date(startAt).getTime();

      if (regStart >= regEnd) {
        setError('Registration start must precede registration end');
        return;
      }
      if (regEnd > cInStart) {
        setError('Registration must close before or when check-in opens');
        return;
      }
      if (cInStart >= cInEnd) {
        setError('Check-in start must precede check-in end');
        return;
      }
      if (cInEnd > tourneyStart) {
        setError('Check-in must close before the tournament begins');
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const sb = getSupabaseBrowserClient();
      if (!sb) throw new Error('Supabase not configured');
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Please sign in to publish a tournament');

      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          description,
          coverImageUrl,
          eventType,
          instrument,
          capacity,
          minParticipants: TOURNAMENT_CONFIG.SIZES.MIN_REQUIRED[capacity],
          roomMode,
          songSelectionPolicy: songPolicy,
          registrationStartAt: new Date(registrationStartAt).toISOString(),
          registrationEndAt: new Date(registrationEndAt).toISOString(),
          checkInStartAt: new Date(checkInStartAt).toISOString(),
          checkInEndAt: new Date(checkInEndAt).toISOString(),
          startAt: new Date(startAt).toISOString(),
          rulesText,
          publishNow: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create tournament');

      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creating tournament');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-xl max-h-[92vh] bg-[#0d0f15] border border-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Create Tournament
              </h2>
              <p className="text-[11px] text-gray-400">Step {step} of 4</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: BASICS */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Tournament Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Kingdom Praise Championship"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white placeholder-gray-500 outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the competition, audience, or hymn focus..."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-400 transition resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Cover Image
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {DEFAULT_COVER_IMAGES.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setCoverImageUrl(img.url)}
                      className={`relative h-16 rounded-xl overflow-hidden border transition ${
                        coverImageUrl === img.url
                          ? 'border-amber-400 ring-2 ring-amber-400/40'
                          : 'border-gray-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-sm">
                        {img.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Event Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEventType('official')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                      eventType === 'official'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    Official Championship
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType('community')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                      eventType === 'community'
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    Community Open
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FORMAT & CAPACITY */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Instrument Selection *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInstrument('piano')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                      instrument === 'piano'
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    Piano Tiles (Neon Keys)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstrument('guitar')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                      instrument === 'guitar'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    Guitar Tiles (Fretboard)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Participant Capacity (Single Elimination)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([4, 8, 16] as const).map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setCapacity(cap)}
                      className={`p-3 rounded-xl border text-center font-bold text-xs transition ${
                        capacity === cap
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 glow-gold'
                          : 'bg-gray-900 border-gray-800 text-gray-400'
                      }`}
                    >
                      {cap} Players
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Match Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoomMode('ranked')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                      roomMode === 'ranked'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    Ranked Competition
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomMode('casual')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                      roomMode === 'casual'
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    Casual Tournament
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Song Selection Policy
                </label>
                <div className="space-y-2">
                  {TOURNAMENT_CONFIG.SONG_POLICIES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSongPolicy(p.id)}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition ${
                        songPolicy === p.id
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          : 'bg-gray-900 border-gray-800 text-gray-400'
                      }`}
                    >
                      <p className="font-bold">{p.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SCHEDULE */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Timeline must follow chronological order: Registration &rarr; Check-In &rarr; Start.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                    Registration Opens
                  </label>
                  <input
                    type="datetime-local"
                    value={registrationStartAt}
                    onChange={(e) => setRegistrationStartAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                    Registration Closes
                  </label>
                  <input
                    type="datetime-local"
                    value={registrationEndAt}
                    onChange={(e) => setRegistrationEndAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                    Check-In Opens
                  </label>
                  <input
                    type="datetime-local"
                    value={checkInStartAt}
                    onChange={(e) => setCheckInStartAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                    Check-In Closes
                  </label>
                  <input
                    type="datetime-local"
                    value={checkInEndAt}
                    onChange={(e) => setCheckInEndAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                  Tournament Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW & PUBLISH */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-2 text-xs">
                <h4 className="text-sm font-black text-amber-400">{title}</h4>
                <p className="text-gray-400">{description || 'No description provided.'}</p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800/80 text-[11px]">
                  <div>
                    <span className="text-gray-500">Instrument:</span>{' '}
                    <strong className="text-white capitalize">{instrument}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Capacity:</span>{' '}
                    <strong className="text-white">{capacity} Players</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Mode:</span>{' '}
                    <strong className="text-white capitalize">{roomMode}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Song Policy:</span>{' '}
                    <strong className="text-white capitalize">{songPolicy.replace('_', ' ')}</strong>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
                  Conduct & Specific Rules (Optional)
                </label>
                <textarea
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  placeholder="Special instructions for competitors..."
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-400 transition resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/80 bg-gray-950/70">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition shadow"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 transition shadow-lg glow-gold disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[3]" />
              )}
              <span>Publish Tournament</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
