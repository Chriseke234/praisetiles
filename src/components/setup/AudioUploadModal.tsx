'use client';

import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, Loader2, Music, ArrowLeft } from 'lucide-react';
import { validateAudioFile } from '@/lib/audio/validator';
import { generateRhythmMapFromAudio } from '@/lib/audio/analyzer';
import { generateSyntheticGospelTrack } from '@/lib/audio/synth';
import { GameAudioPlayer } from '@/lib/audio/player';
import { RhythmMap, InstrumentType } from '@/types/game';

interface AudioUploadModalProps {
  instrument: InstrumentType;
  audioPlayer: GameAudioPlayer;
  onAudioReady: (buffer: AudioBuffer, map: RhythmMap, title: string) => void;
  /** Optional callback to skip preview and go straight to gameplay */
  onQuickPlay?: (buffer: AudioBuffer, map: RhythmMap, title: string) => void;
  onBack: () => void;
}

export const AudioUploadModal: React.FC<AudioUploadModalProps> = ({
  instrument,
  audioPlayer,
  onAudioReady,
  onQuickPlay,
  onBack,
}) => {
  // Rights checkbox removed — upload proceeds without a consent gate
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [skipPreview, setSkipPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus('Reading audio file...');

    try {
      const ctx = await audioPlayer.ensureContext();
      setProcessingStatus('Verifying headers and decoding audio...');

      const validation = await validateAudioFile(file, ctx);

      if (!validation.valid || !validation.buffer) {
        setIsProcessing(false);
        setErrorMessage(validation.error || 'Failed to validate audio file.');
        return;
      }

      setProcessingStatus('Analyzing rhythm and generating 3-Star map...');
      // Allow UI thread to breathe
      await new Promise((r) => setTimeout(r, 100));

      const title = file.name.replace(/\.[^/.]+$/, '');
      const map = generateRhythmMapFromAudio(validation.buffer, title);

      audioPlayer.setBuffer(validation.buffer);
      setIsProcessing(false);

      // Route to preview or direct gameplay based on user preference
      if (skipPreview && onQuickPlay) {
        onQuickPlay(validation.buffer, map, title);
      } else {
        onAudioReady(validation.buffer, map, title);
      }
    } catch {
      setIsProcessing(false);
      setErrorMessage('An unexpected error occurred during audio decoding or analysis.');
    }
  };

  const handleDemoTrack = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus('Synthesizing 120 BPM Royalty-Free Gospel Praise Track...');

    try {
      const ctx = await audioPlayer.ensureContext();
      // Generate synthetic praise hymn
      const buffer = generateSyntheticGospelTrack(ctx);
      const title = 'Demo Gospel Praise Hymn (120 BPM)';
      setProcessingStatus('Generating 3-Star progressive rhythm map...');
      await new Promise((r) => setTimeout(r, 150));

      const map = generateRhythmMapFromAudio(buffer, title);
      audioPlayer.setBuffer(buffer);
      setIsProcessing(false);

      // Route to preview or direct gameplay based on user preference
      if (skipPreview && onQuickPlay) {
        onQuickPlay(buffer, map, title);
      } else {
        onAudioReady(buffer, map, title);
      }
    } catch {
      setIsProcessing(false);
      setErrorMessage('Failed to synthesize demo praise track.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 bg-[#0b0816] text-gray-100">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-purple-600/15 via-amber-500/10 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-gray-950/90 border border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Instruments
          </button>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400">
            {instrument === 'piano' ? 'Piano Tiles' : 'Guitar Tiles'} Mode
          </span>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-400 via-amber-200 to-purple-300 bg-clip-text text-transparent tracking-tight">
            Upload Gospel Track
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Choose an audio file between 30s and 5m (up to 15 MB) to generate your rhythm map.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Upload Preferences */}
        <div className="mb-5 space-y-2">
          {/* Quick Play (Skip Preview) Toggle per GDD §4 */}
          <div className="p-3 rounded-xl bg-gray-900/40 border border-gray-800/80 flex items-center justify-between">
            <label htmlFor="skip-preview" className="text-xs text-gray-400 cursor-pointer select-none flex items-center gap-2">
              <span>Quick Play (skip rhythm map preview)</span>
            </label>
            <input
              type="checkbox"
              id="skip-preview"
              checked={skipPreview}
              onChange={(e) => setSkipPreview(e.target.checked)}
              className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900 cursor-pointer"
            />
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
            dragActive
              ? 'border-purple-400 bg-purple-500/15 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
              : 'border-gray-800 hover:border-purple-500/50 bg-gray-900/40 hover:bg-purple-950/15'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,video/mp4"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processFile(e.target.files[0]);
              }
            }}
          />

          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center mb-3 shadow-md">
            <Upload className="w-6 h-6 text-amber-400" />
          </div>

          <h3 className="text-sm sm:text-base font-bold text-white">
            Choose an audio file or drag & drop
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            MP3, WAV, or MP4 audio &bull; Max 15 MB &bull; 30s to 5 minutes
          </p>

          <span className="mt-4 px-4 py-2 rounded-xl bg-gray-800 hover:bg-purple-900/50 hover:text-white border border-gray-700/60 text-xs font-semibold text-gray-200 transition">
            Browse Files
          </span>
        </div>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-gray-800" />
          <span className="absolute px-3 bg-gray-950 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            Or Play Immediately
          </span>
        </div>

        {/* Synthetic Demo Praise Track Button */}
        <button
          onClick={handleDemoTrack}
          disabled={isProcessing}
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 via-gray-900 to-amber-950/40 border border-purple-500/30 hover:border-amber-400/70 text-left flex items-center justify-between group transition glow-purple hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:text-amber-300 transition">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                  Play Royalty-Free Demo Praise Track
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  Instant
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Upbeat 120 BPM gospel hymn with authentic praise chords. No file required.
              </p>
            </div>
          </div>
          <span className="text-amber-400 text-sm font-bold group-hover:translate-x-1 transition">
            &rarr;
          </span>
        </button>

        {/* Loading Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-gray-950/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center z-20">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
            <h4 className="text-base font-bold text-white">Preparing Praise Session</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">{processingStatus}</p>
          </div>
        )}
      </div>
    </div>
  );
};
