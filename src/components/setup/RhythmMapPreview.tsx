'use client';

import React from 'react';
import { RhythmMap, InstrumentType } from '@/types/game';
import { Play, RotateCcw, Star, Info, Music2 } from 'lucide-react';

interface RhythmMapPreviewProps {
  map: RhythmMap;
  instrument: InstrumentType;
  onChangeInstrument: (instrument: InstrumentType) => void;
  onStartGame: () => void;
  onReset: () => void;
}

export const RhythmMapPreview: React.FC<RhythmMapPreviewProps> = ({
  map,
  instrument,
  onChangeInstrument,
  onStartGame,
  onReset,
}) => {
  const durationMin = Math.floor(map.duration / 60);
  const durationSec = Math.floor(map.duration % 60);
  const formattedDuration = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;
  const notesPerSec = (map.totalNotes / map.duration).toFixed(1);

  const star1Notes = map.notes.filter((n) => n.time < map.stages.star1End).length;
  const star2Notes = map.notes.filter((n) => n.time >= map.stages.star1End && n.time < map.stages.star2End).length;
  const star3Notes = map.notes.filter((n) => n.time >= map.stages.star2End).length;

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 bg-[#090a0f] text-gray-100">
      <div className="w-full max-w-xl bg-gray-950/90 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Music2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white truncate max-w-[260px] sm:max-w-xs">
              {map.songTitle}
            </h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 font-mono">
            {formattedDuration}
          </span>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800">
            <span className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
              Total Notes
            </span>
            <p className="text-xl font-extrabold text-amber-400 mt-0.5">{map.totalNotes}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800">
            <span className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
              Avg Density
            </span>
            <p className="text-xl font-extrabold text-cyan-400 mt-0.5">{notesPerSec} /s</p>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-gray-900/80 border border-gray-800">
            <span className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
              Lanes
            </span>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">4 Lanes</p>
          </div>
        </div>

        {/* 3-Star Progression Preview */}
        <div className="mb-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            3-Star Stage Progression
          </h3>

          <div className="space-y-2">
            {/* Star 1 */}
            <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">
                  ★1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-200">Establish the Rhythm</h4>
                  <p className="text-[11px] text-gray-400">Introductory density, primary lanes</p>
                </div>
              </div>
              <span className="text-xs font-mono text-gray-400">{star1Notes} notes</span>
            </div>

            {/* Star 2 */}
            <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs">
                  ★2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-200">Build Intensity</h4>
                  <p className="text-[11px] text-gray-400">Expanded 4-lane syncopation</p>
                </div>
              </div>
              <span className="text-xs font-mono text-gray-400">{star2Notes} notes</span>
            </div>

            {/* Star 3 */}
            <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-xs">
                  ★3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-200">Final Challenge</h4>
                  <p className="text-[11px] text-gray-400">Peak praise climax and fast runs</p>
                </div>
              </div>
              <span className="text-xs font-mono text-gray-400">{star3Notes} notes</span>
            </div>
          </div>
        </div>

        {/* Instrument Switcher */}
        <div className="mb-6 flex items-center justify-between p-3 rounded-xl bg-gray-900/80 border border-gray-800">
          <span className="text-xs text-gray-300 font-medium">Selected Presentation:</span>
          <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => onChangeInstrument('piano')}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                instrument === 'piano'
                  ? 'bg-cyan-500 text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Piano Tiles
            </button>
            <button
              onClick={() => onChangeInstrument('guitar')}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                instrument === 'guitar'
                  ? 'bg-amber-500 text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Guitar Tiles
            </button>
          </div>
        </div>

        {/* Musical Sync Note */}
        <div className="mb-6 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-start gap-2 text-[11px] text-purple-200/80">
          <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <p>
            Rhythm map synchronized to the musical beat and phrasing. Original song audio is preserved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onStartGame}
            className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg glow-gold transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            <Play className="w-5 h-5 fill-black" />
            Start Praise Run
          </button>
          <button
            onClick={onReset}
            className="w-full sm:w-auto py-4 px-5 rounded-2xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Change Track
          </button>
        </div>
      </div>
    </div>
  );
};
