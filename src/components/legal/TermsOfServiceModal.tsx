'use client';

import React from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="terms-title" className="text-lg font-bold text-white">
                Terms of Service
              </h2>
              <p className="text-xs text-slate-400">
                PraiseTiles Gospel Rhythm Gaming Platform &bull; v7.0.0
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Terms of Service dialog"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-slate-300 leading-relaxed scrollbar-thin">
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              1. Platform Purpose & Community Focus
            </h3>
            <p>
              PraiseTiles is a faith-oriented, browser-first rhythm game dedicated exclusively to Christian worship, gospel, and inspirational music. All participants agree to maintain a respectful, constructive, and uplifting community environment across text chat, quick reactions, and multiplayer rooms.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              2. Audio Upload Rights & Content Ownership
            </h3>
            <p>
              Users may upload audio recordings strictly for real-time procedural rhythm-map generation and gameplay playback within authorized rooms. By uploading any audio file, you confirm that you possess all requisite rights, licenses, or permissions to use the content for private or multiplayer interactive playback.
            </p>
            <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              Temporary room audio uploaded by hosts is automatically scrubbed and permanently deleted from cloud storage upon room expiration or match conclusion.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              3. Competitive Integrity & Fair Play
            </h3>
            <p>
              Use of automated gameplay macros, input bots, client timing tampering, score manipulation, or network exploitation in casual, ranked, or tournament brackets is strictly forbidden. Violations result in competitive rating nullification and permanent account suspension.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              4. Code of Conduct & Moderation
            </h3>
            <p>
              Harassment, profanity, hate speech, abusive lobby spam, or disruptive behavior will not be tolerated. Players may utilize the in-game reporting and blocking controls. Moderators reserve the right to review reported matches and enforce sanctions.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              5. Disclaimers & Availability
            </h3>
            <p>
              PraiseTiles is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis. Audio decoding, onset rhythm-map generation, and network latency calibration may vary depending on client hardware and browser audio subsystem capabilities.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
