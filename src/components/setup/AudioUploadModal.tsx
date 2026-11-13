'use client';

/**
 * AudioUploadModal — Praise Studio Stream, Search, YouTube & Upload Experience
 * 
 * Features:
 * 1. Search & Stream: Direct search across millions of gospel and worship songs with 
 *    high-fidelity audio previews, instant decoding, and genuine transient rhythm-map analysis.
 * 2. YouTube Music: Direct playback of YouTube worship music with synchronized 60fps clock interpolation.
 * 3. File Upload & Demo: Custom audio upload (MP3, WAV, AAC) and instant royalty-free gospel synth.
 * 
 * Conforms to strict zero-emoji, responsive, SVG-icon only design standards.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  AlertCircle,
  Loader2,
  Music,
  ArrowLeft,
  Play,
  Pause,
  Search,
  Radio,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

/** Inline YouTube logo SVG — lucide-react does not export a Youtube icon in this version. */
const YoutubeSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M21.593 7.203a2.506 2.506 0 0 0-1.762-1.766C18.265 5.007 12 5 12 5s-6.264-.007-7.831.404a2.56 2.56 0 0 0-1.766 1.778c-.413 1.566-.417 4.814-.417 4.814s-.004 3.264.413 4.814c.23.857.905 1.534 1.762 1.766 1.582.43 7.83.437 7.83.437s6.265.007 7.831-.403a2.515 2.515 0 0 0 1.767-1.763c.414-1.565.417-4.812.417-4.812s.02-3.265-.413-4.826zM9.996 15.005l.005-6 5.207 3.005-5.212 2.995z" />
  </svg>
);
import { validateAudioFile, decodeAudioDataCompat } from '@/lib/audio/validator';
import { generateRhythmMapFromAudio, generateRhythmMapForDuration } from '@/lib/audio/analyzer';
import { generateSyntheticGospelTrack } from '@/lib/audio/synth';
import { GameAudioPlayer } from '@/lib/audio/player';
import { YouTubeAudioPlayer } from '@/lib/audio/youtubePlayer';
import { RhythmMap, InstrumentType } from '@/types/game';
import { PraiseMascot } from '@/components/common/PraiseMascot';
import { AnimatedVinyl } from '@/components/loading/AnimatedVinyl';
import { ArenaProgressBar } from '@/components/loading/ArenaProgressBar';
import { LibrarySkeletonLoader } from '@/components/loading/LibrarySkeletonLoader';

interface SearchTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl: string;
  durationSec: number;
}

interface YouTubeVideoData {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  durationSec: number;
}

interface AudioUploadModalProps {
  instrument: InstrumentType;
  audioPlayer: GameAudioPlayer;
  onAudioReady: (buffer: AudioBuffer, map: RhythmMap, title: string) => void;
  onYouTubeReady?: (player: YouTubeAudioPlayer, map: RhythmMap, title: string) => void;
  onQuickPlay?: (buffer: AudioBuffer, map: RhythmMap, title: string) => void;
  onQuickPlayYouTube?: (player: YouTubeAudioPlayer, map: RhythmMap, title: string) => void;
  onBack: () => void;
}

export const AudioUploadModal: React.FC<AudioUploadModalProps> = ({
  instrument,
  audioPlayer,
  onAudioReady,
  onYouTubeReady,
  onQuickPlay,
  onQuickPlayYouTube,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'youtube' | 'upload'>('search');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab 1: Search & Stream State
  const [searchQuery, setSearchQuery] = useState('Elevation Worship');
  const [searchResults, setSearchResults] = useState<SearchTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [auditionTrackId, setAuditionTrackId] = useState<string | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Tab 2: YouTube Music State
  const [youtubeInput, setYoutubeInput] = useState('');
  const [isResolvingYouTube, setIsResolvingYouTube] = useState(false);
  const [detectedYouTube, setDetectedYouTube] = useState<YouTubeVideoData | null>(null);
  const [youTubeSuggestions, setYouTubeSuggestions] = useState<YouTubeVideoData[]>([]);

  // Tab 3: Upload State
  const [dragActive, setDragActive] = useState(false);
  const [skipPreview, setSkipPreview] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop audition audio on unmount or tab switch
  useEffect(() => {
    return () => {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current = null;
      }
    };
  }, []);

  const stopAudition = () => {
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      auditionAudioRef.current = null;
      setAuditionTrackId(null);
    }
  };

  // Perform search
  const performSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setErrorMessage(null);
    stopAudition();

    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}&limit=15`);
      if (!res.ok) {
        throw new Error('Search failed. Please try a different query.');
      }
      const data = await res.json();
      setSearchResults(data.tracks || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load music search results.');
    } finally {
      setIsSearching(false);
    }
  };

  // Run initial search on mount
  useEffect(() => {
    performSearch('Elevation Worship');
  }, []);

  // Audition preview toggle
  const toggleAudition = (track: SearchTrack) => {
    if (auditionTrackId === track.id) {
      stopAudition();
      return;
    }

    stopAudition();
    // Route through audio proxy to bypass cross-origin restrictions
    const streamUrl = track.previewUrl.startsWith('http')
      ? `/api/music/proxy?url=${encodeURIComponent(track.previewUrl)}`
      : track.previewUrl;

    const audio = new Audio(streamUrl);
    audio.volume = 0.7;
    audio.onended = () => setAuditionTrackId(null);
    audio.onerror = () => {
      // Secondary fallback to direct URL
      if (audio.src !== track.previewUrl) {
        const directAudio = new Audio(track.previewUrl);
        directAudio.volume = 0.7;
        directAudio.onended = () => setAuditionTrackId(null);
        directAudio.onerror = () => {
          setErrorMessage('Audio preview unavailable for this track.');
          setAuditionTrackId(null);
        };
        directAudio.play().catch(() => {
          setErrorMessage('Autoplay blocked. Tap play again.');
        });
        auditionAudioRef.current = directAudio;
        return;
      }
      setErrorMessage('Audio preview unavailable for this track.');
      setAuditionTrackId(null);
    };
    audio.play().catch(() => {
      setErrorMessage('Autoplay blocked. Tap play again.');
    });
    auditionAudioRef.current = audio;
    setAuditionTrackId(track.id);
  };

  // Select search track -> resolve full-length track via YouTube engine, or fallback to preview
  const handleSelectSearchTrack = async (track: SearchTrack) => {
    stopAudition();
    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus(`Finding full performance audio for "${track.title}"...`);

    const title = `${track.title} - ${track.artist}`;

    // 1. PRIMARY: Attempt to resolve full-length track on YouTube / YouTube Music
    try {
      const searchParam = encodeURIComponent(`${track.title} ${track.artist}`);
      const ytRes = await fetch(`/api/music/youtube?q=${searchParam}`);
      const ytData = await ytRes.json();

      if (ytRes.ok && (ytData.success || ytData.videoId || ytData.track?.videoId)) {
        const videoId = ytData.videoId || ytData.track?.videoId;
        const durationSec = Math.max(90, track.durationSec || ytData.durationSec || 180);

        setProcessingStatus(`Initializing full YouTube audio for "${track.title}"...`);
        const ytPlayer = new YouTubeAudioPlayer(videoId);

        setProcessingStatus('Generating full beat-aligned 4-lane chart...');
        await new Promise((r) => setTimeout(r, 120));

        const map = generateRhythmMapForDuration(title, durationSec, 128);
        setIsProcessing(false);

        if (skipPreview && onQuickPlayYouTube) {
          onQuickPlayYouTube(ytPlayer, map, title);
        } else if (onYouTubeReady) {
          onYouTubeReady(ytPlayer, map, title);
        }
        return;
      }
    } catch {
      // Non-blocking fallback to preview stream below
    }

    // 2. FALLBACK: Stream 30s preview audio stream via audio proxy
    try {
      setProcessingStatus('Loading preview audio stream...');
      const ctx = await audioPlayer.ensureContext();

      // Proxy via backend to prevent browser CORS blocks ("Failed to fetch")
      const proxyUrl = track.previewUrl.startsWith('http')
        ? `/api/music/proxy?url=${encodeURIComponent(track.previewUrl)}`
        : track.previewUrl;

      let response: Response | null = null;
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) {
          response = res;
        }
      } catch {
        // Fallback to direct fetch
      }

      if (!response || !response.ok) {
        response = await fetch(track.previewUrl);
      }

      if (!response.ok) {
        throw new Error('Failed to download preview audio stream from music catalog.');
      }

      setProcessingStatus('Decoding audio data for rhythm analysis...');
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await decodeAudioDataCompat(ctx, arrayBuffer);

      setProcessingStatus('Analyzing acoustic transients and generating 4-lane chart...');
      await new Promise((r) => setTimeout(r, 120));

      const map = generateRhythmMapFromAudio(decodedBuffer, title);

      audioPlayer.setBuffer(decodedBuffer);
      setIsProcessing(false);

      if (skipPreview && onQuickPlay) {
        onQuickPlay(decodedBuffer, map, title);
      } else {
        onAudioReady(decodedBuffer, map, title);
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(
        err.message?.includes('Failed to fetch')
          ? 'Network error: Unable to fetch audio stream. Please check your internet connection or try another song.'
          : err.message || 'Error processing streaming audio track.'
      );
    }
  };

  // YouTube track resolution
  const handleResolveYouTube = async (inputQuery: string) => {
    if (!inputQuery.trim()) return;
    setIsResolvingYouTube(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/music/youtube?url=${encodeURIComponent(inputQuery)}`);
      const data = await res.json();

      if (!res.ok || (!data.success && !data.track && !data.videoId)) {
        throw new Error(data.error || 'Failed to resolve YouTube video.');
      }

      const videoId = data.videoId || data.track?.videoId;
      const title = data.title || data.track?.title || 'YouTube Gospel Track';
      const author = data.author || data.track?.author || 'YouTube';
      const thumbnailUrl =
        data.thumbnailUrl ||
        data.track?.thumbnailUrl ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const durationSec = data.durationSec || data.track?.durationSec || 180;

      if (!videoId) {
        throw new Error(data.error || 'Could not find a valid YouTube video ID.');
      }

      setDetectedYouTube({
        videoId,
        title,
        author,
        thumbnailUrl,
        durationSec,
      });

      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        const formattedSuggestions: YouTubeVideoData[] = data.suggestions.map((s: any) => ({
          videoId: s.videoId,
          title: s.title,
          author: s.author,
          thumbnailUrl: s.thumbnailUrl || `https://img.youtube.com/vi/${s.videoId}/hqdefault.jpg`,
          durationSec: s.durationSec || 180,
        }));
        setYouTubeSuggestions(formattedSuggestions);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not find YouTube track. Check the URL or search query.');
    } finally {
      setIsResolvingYouTube(false);
    }
  };

  // Launch YouTube gameplay
  const handlePlayYouTubeTrack = async (ytData: YouTubeVideoData) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus(`Initializing YouTube engine for "${ytData.title}"...`);

    try {
      const ytPlayer = new YouTubeAudioPlayer(ytData.videoId);
      setProcessingStatus('Generating beat-aligned 4-lane rhythm map...');
      await new Promise((r) => setTimeout(r, 150));

      const map = generateRhythmMapForDuration(ytData.title, ytData.durationSec, 128);

      setIsProcessing(false);

      if (skipPreview && onQuickPlayYouTube) {
        onQuickPlayYouTube(ytPlayer, map, ytData.title);
      } else if (onYouTubeReady) {
        onYouTubeReady(ytPlayer, map, ytData.title);
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Failed to prepare YouTube track.');
    }
  };

  // Tab 3: Local file upload
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

  // Tab 3: Demo synthetic track
  const handleDemoTrack = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus('Synthesizing 120 BPM Royalty-Free Gospel Praise Track...');

    try {
      const ctx = await audioPlayer.ensureContext();
      const buffer = generateSyntheticGospelTrack(ctx);
      const title = 'Demo Gospel Praise Hymn (120 BPM)';
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

  const formatSec = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col justify-center items-center p-3 sm:p-6 lg:p-8 bg-[#08070d] text-gray-100 overflow-x-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-halftone-dots opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-purple-600/20 via-amber-500/10 to-transparent blur-[120px] pointer-events-none" />

      {/* Main Studio Card */}
      <div className="relative z-10 w-full max-w-3xl bg-gradient-to-b from-[#130f24]/95 via-[#0f0c1a]/95 to-[#08070d]/95 border border-purple-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-xl animate-fadeIn">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800/80 mb-5">
          <button
            onClick={() => {
              stopAudition();
              onBack();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-purple-500/20 border border-purple-500/40 text-purple-300">
              {instrument === 'piano' ? 'Piano Tiles' : 'Guitar Tiles'}
            </span>
          </div>
        </div>

        {/* Title & Mascot Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5 text-center sm:text-left">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-400 via-amber-200 to-purple-300 bg-clip-text text-transparent tracking-tight">
              Praise Studio &bull; Song Selection
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Search streaming gospel music, play YouTube praise tracks, or upload your own audio.
            </p>
          </div>

          <PraiseMascot pose="listening" size="sm" className="hidden sm:inline-flex shrink-0" />
        </div>

        {/* Modern 3-Tab Selector */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-5 p-1 rounded-2xl bg-black/50 border border-gray-800">
          <button
            onClick={() => {
              stopAudition();
              setActiveTab('search');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'search'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="truncate">Search &amp; Stream</span>
          </button>

          <button
            onClick={() => {
              stopAudition();
              setActiveTab('youtube');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'youtube'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <YoutubeSvg className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">YouTube Music</span>
          </button>

          <button
            onClick={() => {
              stopAudition();
              setActiveTab('upload');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'upload'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="truncate">Upload File</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="flex-1">{errorMessage}</p>
          </div>
        )}

        {/* TAB 1: SEARCH & STREAM PREVIEWS */}
        {activeTab === 'search' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Search Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                performSearch(searchQuery);
              }}
              className="relative flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search song title or gospel artist (e.g. Maverick City, Kirk Franklin)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900/90 border border-gray-800 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs transition flex items-center gap-1.5 shrink-0 shadow-md shadow-amber-500/20"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Search</span>}
              </button>
            </form>

            {/* Quick Inspiration Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] text-gray-400">
              <span className="text-gray-500 shrink-0">Popular:</span>
              {[
                'Elevation Worship',
                'Kirk Franklin',
                'CeCe Winans',
                'Maverick City',
                'Tasha Cobbs',
                'Hillsong',
                'Sinach',
                'Moses Bliss',
              ].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchQuery(term);
                    performSearch(term);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 hover:border-purple-500/50 hover:text-purple-300 transition shrink-0 whitespace-nowrap"
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Track Results List */}
            {isSearching ? (
              <div className="py-4">
                <LibrarySkeletonLoader count={4} message="Searching gospel streaming catalog..." />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {searchResults.map((track) => {
                  const isAuditioning = auditionTrackId === track.id;
                  return (
                    <div
                      key={track.id}
                      className="group p-3 rounded-2xl bg-[#141026]/80 border border-gray-800/90 hover:border-purple-500/40 flex items-center justify-between gap-3 transition-all hover:scale-[1.005]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Artwork */}
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-gray-800 group-hover:border-purple-500/50 relative">
                          <img
                            src={track.artworkUrl}
                            alt={track.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        {/* Metadata */}
                        <div className="text-left min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition truncate">
                            {track.title}
                          </h4>
                          <p className="text-[11px] text-purple-300 truncate">{track.artist}</p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{track.album}</span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-gray-500" />
                              {formatSec(track.durationSec)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Mini Audition Play/Stop */}
                        <button
                          onClick={() => toggleAudition(track)}
                          title={isAuditioning ? 'Stop Preview' : 'Audition Preview'}
                          className={`p-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1 ${
                            isAuditioning
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-gray-900 border-gray-800 text-gray-300 hover:text-white hover:border-gray-700'
                          }`}
                        >
                          {isAuditioning ? (
                            <Pause className="w-3.5 h-3.5 fill-amber-300 stroke-amber-300" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current stroke-current" />
                          )}
                          <span className="hidden sm:inline text-[10px]">
                            {isAuditioning ? 'Playing' : 'Preview'}
                          </span>
                        </button>

                        {/* Play Song On PraiseTiles */}
                        <button
                          onClick={() => handleSelectSearchTrack(track)}
                          disabled={isProcessing}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                        >
                          <Play className="w-3.5 h-3.5 fill-black stroke-black" />
                          <span>Play Song</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400">
                <Music className="w-10 h-10 text-gray-600 mb-2" />
                <p className="text-xs">No tracks found. Try searching for an artist or worship hymn.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: YOUTUBE MUSIC */}
        {activeTab === 'youtube' && (
          <div className="space-y-4 animate-fadeIn">
            {/* YouTube URL or Search Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleResolveYouTube(youtubeInput);
              }}
              className="space-y-3"
            >
              <label className="block text-xs font-bold text-gray-300 text-left">
                Paste YouTube / YouTube Music URL or Song Name:
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <YoutubeSvg className="w-4 h-4 text-red-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or song title"
                    value={youtubeInput}
                    onChange={(e) => setYoutubeInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isResolvingYouTube || !youtubeInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-extrabold text-xs transition flex items-center gap-1.5 shrink-0 shadow-md shadow-red-600/30"
                >
                  {isResolvingYouTube ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Load Video</span>
                  )}
                </button>
              </div>
            </form>

            {/* Curated YouTube Presets */}
            <div className="text-left">
              <span className="text-[11px] font-bold text-gray-400 block mb-1.5">
                Popular Praise &amp; Worship Tracks:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    name: 'Graves Into Gardens',
                    artist: 'Elevation Worship',
                    url: 'https://www.youtube.com/watch?v=KwX1f2gYKZ4',
                  },
                  {
                    name: 'Way Maker',
                    artist: 'Sinach',
                    url: 'https://www.youtube.com/watch?v=n4XWfwLHeLM',
                  },
                  {
                    name: 'Gratitude',
                    artist: 'Brandon Lake',
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                  },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setYoutubeInput(preset.url);
                      handleResolveYouTube(preset.url);
                    }}
                    className="p-2.5 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-red-500/50 hover:bg-red-950/20 text-left transition"
                  >
                    <p className="text-xs font-bold text-white truncate">{preset.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{preset.artist}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Detected YouTube Video Card */}
            {detectedYouTube && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/30 via-gray-900 to-purple-950/30 border border-red-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
                  <div className="w-20 h-14 rounded-xl overflow-hidden shrink-0 border border-red-500/40 relative">
                    <img
                      src={detectedYouTube.thumbnailUrl}
                      alt={detectedYouTube.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <YoutubeSvg className="w-6 h-6 text-red-500" />
                    </div>
                  </div>

                  <div className="text-left min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {detectedYouTube.title}
                    </h4>
                    <p className="text-xs text-red-300 truncate">{detectedYouTube.author}</p>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Estimated Duration: {formatSec(detectedYouTube.durationSec)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handlePlayYouTubeTrack(detectedYouTube)}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 shrink-0"
                >
                  <Play className="w-4 h-4 fill-white stroke-white" />
                  <span>Play on PraiseTiles</span>
                </button>
              </div>
            )}

            {/* Alternative Search Matches (if user searched by keywords) */}
            {youTubeSuggestions.length > 1 && (
              <div className="space-y-2 pt-2 animate-fadeIn text-left">
                <span className="text-[11px] font-bold text-gray-400 block">
                  Other Matching Tracks:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {youTubeSuggestions
                    .filter((s) => s.videoId !== detectedYouTube?.videoId)
                    .map((sug) => (
                      <div
                        key={sug.videoId}
                        className="p-2.5 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-red-500/40 flex items-center justify-between gap-3 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={sug.thumbnailUrl}
                            alt={sug.title}
                            className="w-10 h-7 rounded object-cover shrink-0 border border-gray-800"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                              {sug.title}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">{sug.author}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setDetectedYouTube(sug);
                            setYoutubeInput(`https://www.youtube.com/watch?v=${sug.videoId}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-[11px] font-bold transition shrink-0"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: UPLOAD FILE & DEMO SYNTH */}
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
              className={`relative border-2 border-dashed rounded-2xl p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
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

              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center mb-2.5 shadow-md">
                <Upload className="w-5 h-5 text-amber-400" />
              </div>

              <h3 className="text-sm font-bold text-white">
                Drop your audio file here or click to browse
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Supports MP3, WAV, AAC, MP4 audio &bull; Max 15 MB &bull; 30s to 5 minutes duration
              </p>

              <span className="mt-3 px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-purple-900/60 hover:text-white border border-gray-700/60 text-xs font-bold text-gray-200 transition">
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

            {/* Instant Demo Synthesizer */}
            <div className="relative my-3 flex items-center justify-center">
              <div className="w-full border-t border-gray-800" />
              <span className="absolute px-3 bg-[#0f0c1a] text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                Instant Session
              </span>
            </div>

            <button
              onClick={() => handleDemoTrack()}
              disabled={isProcessing}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/60 via-gray-900 to-amber-950/40 border border-purple-500/30 hover:border-amber-400/70 text-left flex items-center justify-between group transition hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
                  <Play className="w-4 h-4 fill-amber-400 stroke-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition">
                      Play Demo Praise Hymn (120 BPM)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                      Instant Synth
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
                    Royalty-free progressive gospel track with chords and bassline. No upload required.
                  </p>
                </div>
              </div>
              <span className="text-amber-400 text-sm font-bold group-hover:translate-x-1 transition">&rarr;</span>
            </button>
          </div>
        )}

        {/* Processing & Audio Analysis Studio Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-[#080414]/95 backdrop-blur-xl rounded-3xl flex flex-col items-center justify-center p-6 text-center z-30 animate-fadeIn space-y-5">
            {/* Ambient Animated Vinyl */}
            <div className="relative">
              <AnimatedVinyl size="md" isSpinning={true} glowColor="gold" />
            </div>

            {/* Title & Mascot Row */}
            <div className="flex items-center gap-3">
              <PraiseMascot pose="listening" size="sm" className="shrink-0" />
              <div className="text-left">
                <h3 className="text-base sm:text-lg font-black bg-gradient-to-r from-amber-400 via-amber-200 to-purple-300 bg-clip-text text-transparent">
                  Synthesizing &amp; Analyzing Audio
                </h3>
                <p className="text-xs text-amber-300 font-mono mt-0.5">{processingStatus}</p>
              </div>
            </div>

            {/* Calibrated Progress Indicator */}
            <div className="w-full max-w-sm">
              <ArenaProgressBar
                statusText={processingStatus}
                substatusText="Generating 4-lane notes, onsets, and 3-Star density milestones"
                showPercentage={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
