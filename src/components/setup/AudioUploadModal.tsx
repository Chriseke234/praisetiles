'use client';

/**
 * AudioUploadModal — Gospel Studio Upload & Discovery Experience
 * Supports drag-and-drop custom audio file analysis, curated sanctuary catalogue selection,
 * and instant royalty-free demo track synthesis.
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  AlertCircle,
  Loader2,
  Music,
  ArrowLeft,
  Sparkles,
  Headphones,
  Play,
  Clock,
  Radio,
  FileAudio,
} from 'lucide-react';
import { validateAudioFile } from '@/lib/audio/validator';
import { generateRhythmMapFromAudio } from '@/lib/audio/analyzer';
import { generateSyntheticGospelTrack } from '@/lib/audio/synth';
import { GameAudioPlayer } from '@/lib/audio/player';
import { RhythmMap, InstrumentType } from '@/types/game';
import { PraiseMascot } from '@/components/common/PraiseMascot';
import { FEATURED_GOSPEL_SONGS } from '@/config/gospelSongs';

interface AudioUploadModalProps {
  instrument: InstrumentType;
  audioPlayer: GameAudioPlayer;
  onAudioReady: (buffer: AudioBuffer, map: RhythmMap, title: string) => void;
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [skipPreview, setSkipPreview] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'catalog'>('upload');
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

      setProcessingStatus('Analyzing rhythm and generating 4-lane map...');
      await new Promise((r) => setTimeout(r, 100));

      const title = customTitle.trim() || file.name.replace(/\.[^/.]+$/, '');
      const map = generateRhythmMapFromAudio(validation.buffer, title);

      audioPlayer.setBuffer(validation.buffer);
      setIsProcessing(false);

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

  const handleDemoTrack = async (songTitleOverride?: string) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus('Synthesizing 120 BPM Royalty-Free Gospel Praise Track...');

    try {
      const ctx = await audioPlayer.ensureContext();
      const buffer = generateSyntheticGospelTrack(ctx);
      const title = songTitleOverride || 'Demo Gospel Praise Hymn (120 BPM)';
      setProcessingStatus('Generating 3-Star progressive rhythm map...');
      await new Promise((r) => setTimeout(r, 150));

      const map = generateRhythmMapFromAudio(buffer, title);
      audioPlayer.setBuffer(buffer);
      setIsProcessing(false);

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
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 bg-[#08070d] text-gray-100 overflow-x-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-halftone-dots opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-purple-600/20 via-amber-500/10 to-transparent blur-[120px] pointer-events-none" />

      {/* Main Studio Card */}
      <div className="relative z-10 w-full max-w-2xl bg-gradient-to-b from-[#130f24]/95 via-[#0f0c1a]/95 to-[#08070d]/95 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-fadeIn">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800/80 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-purple-500/20 border border-purple-500/40 text-purple-300">
              {instrument === 'piano' ? 'Piano Tiles' : 'Guitar Tiles'}
            </span>
          </div>
        </div>

        {/* Title & Mascot Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 text-center sm:text-left">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-400 via-amber-200 to-purple-300 bg-clip-text text-transparent tracking-tight">
              Praise Studio &bull; Song Selection
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Upload your personal worship audio or choose from our sanctuary catalog.
            </p>
          </div>

          <PraiseMascot pose="listening" size="sm" className="hidden sm:inline-flex shrink-0" />
        </div>

        {/* Studio Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-2xl bg-black/50 border border-gray-800">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'upload'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Track</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'catalog'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Sanctuary Catalog</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* TAB 1: UPLOAD AUDIO */}
        {activeTab === 'upload' && (
          <div className="space-y-4 animate-fadeIn">
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
                  : 'border-gray-800 hover:border-purple-500/50 bg-[#120f21]/70 hover:bg-purple-950/20'
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
                Drop your audio file here or click to browse
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Supports MP3, WAV, AAC, MP4 audio &bull; Max 15 MB &bull; 30s to 5 minutes duration
              </p>

              <span className="mt-4 px-4 py-2 rounded-xl bg-gray-800 hover:bg-purple-900/60 hover:text-white border border-gray-700/60 text-xs font-bold text-gray-200 transition">
                Browse Audio File
              </span>
            </div>

            {/* Optional Metadata Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">
                  Custom Song Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Praise Anthem"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">
                  Artist / Choir Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sanctuary Choir"
                  value={customArtist}
                  onChange={(e) => setCustomArtist(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Quick Play Toggle */}
            <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800/80 flex items-center justify-between text-left">
              <label htmlFor="skip-preview" className="text-xs text-gray-300 cursor-pointer select-none">
                <span className="font-semibold block">Quick Play Mode</span>
                <span className="text-[10px] text-gray-400 block">Launch straight into rhythm arena without preview</span>
              </label>
              <input
                type="checkbox"
                id="skip-preview"
                checked={skipPreview}
                onChange={(e) => setSkipPreview(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-gray-800" />
              <span className="absolute px-3 bg-[#0f0c1a] text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                Instant Session
              </span>
            </div>

            {/* Demo Praise Track */}
            <button
              onClick={() => handleDemoTrack()}
              disabled={isProcessing}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-gray-900 to-amber-950/40 border border-purple-500/30 hover:border-amber-400/70 text-left flex items-center justify-between group transition hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
                  <Play className="w-5 h-5 fill-amber-400 stroke-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                      Play Demo Praise Hymn (120 BPM)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                      Instant
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Royalty-free progressive gospel track with chords and bassline. No upload required.
                  </p>
                </div>
              </div>
              <span className="text-amber-400 text-sm font-bold group-hover:translate-x-1 transition">&rarr;</span>
            </button>
          </div>
        )}

        {/* TAB 2: SANCTUARY CATALOG */}
        {activeTab === 'catalog' && (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1 animate-fadeIn">
            {FEATURED_GOSPEL_SONGS.map((song) => (
              <div
                key={song.id}
                onClick={() => handleDemoTrack(song.title)}
                className="group p-3.5 rounded-2xl bg-[#141026]/80 border border-gray-800 hover:border-amber-500/40 cursor-pointer flex items-center justify-between transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-gray-800 group-hover:border-amber-500/50">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left min-w-0">
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition truncate">
                      {song.title}
                    </h4>
                    <p className="text-xs text-purple-300 truncate">{song.artist}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                      <span>{song.duration}</span>
                      <span>&bull;</span>
                      <span className="text-amber-400 font-semibold">{song.difficulty}</span>
                      <span>&bull;</span>
                      <span>{song.bpm} BPM</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDemoTrack(song.title);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 group-hover:bg-amber-400 text-black font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-black stroke-black" />
                  <span>Select</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Processing Spinner Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-30 animate-fadeIn">
            <Loader2 className="w-12 h-12 animate-spin text-amber-400 mb-4" />
            <h3 className="text-lg font-bold text-white">Synthesizing &amp; Analyzing Audio</h3>
            <p className="text-xs text-amber-300 mt-1 font-mono">{processingStatus}</p>
            <p className="text-[11px] text-gray-500 mt-3 max-w-xs">
              Generating 4-lane notes, onset timestamps, and progressive 3-Star density milestones&hellip;
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
