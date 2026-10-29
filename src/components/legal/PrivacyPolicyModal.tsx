'use client';

import React from 'react';
import { X, Lock, EyeOff } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="privacy-title" className="text-lg font-bold text-white">
                Privacy Policy & Audio Retention
              </h2>
              <p className="text-xs text-slate-400">
                Data Handling & Ephemeral Audio Lifecycle &bull; v7.0.0
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Privacy Policy dialog"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-slate-300 leading-relaxed scrollbar-thin">
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-violet-400" aria-hidden="true" />
              1. Ephemeral Audio Storage Guarantee
            </h3>
            <p>
              PraiseTiles does not build a perpetual library of user-uploaded songs. Audio tracks uploaded for private or public multiplayer rooms are stored strictly in temporary cloud buckets with an automatic expiration timestamp (maximum 2 hours).
            </p>
            <p className="text-xs text-slate-400 bg-slate-900 p-3 rounded-xl border border-slate-800">
              Automated server cleanup workers permanently purge expired audio objects and metadata once a match terminates or a room disbands.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              2. Account Information We Collect
            </h3>
            <p>
              When you authenticate via Supabase Auth, we store your email address, display name, avatar choice, progression XP, gem rank tier, competitive rating (Elo), and historical match summaries (scores, accuracy, star rating).
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              3. Guest Play & Data Privacy
            </h3>
            <p>
              Guest players can enjoy solo and multiplayer gameplay with a locally stored anonymous identifier. Guest accounts do not require an email or password. You can seamlessly convert your guest profile to a permanent account at any time without losing XP or match history.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              4. Cookies & Browser Storage
            </h3>
            <p>
              We utilize browser localStorage solely for gameplay settings (volume, audio calibration offset, reduced motion preferences) and session persistence. We do not engage in cross-site tracking or third-party advertising cookies.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              5. Data Deletion Requests
            </h3>
            <p>
              Users may request deletion of their account profile and match history by submitting an inquiry or removing their registered session.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            Close Privacy Policy
          </button>
        </div>
      </div>
    </div>
  );
};
