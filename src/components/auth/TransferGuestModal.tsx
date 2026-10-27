'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { ArrowRightLeft, CheckCircle, Trash2, Loader2 } from 'lucide-react';

export const TransferGuestModal: React.FC = () => {
  const { pendingTransferMatches, transferGuestSession, dismissTransferPrompt } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (pendingTransferMatches.length === 0) return null;

  const totalMatches = pendingTransferMatches.length;
  const completedCount = pendingTransferMatches.filter((m) => m.completed).length;

  const handleTransfer = async () => {
    setIsSubmitting(true);
    await transferGuestSession();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 mx-auto flex items-center justify-center text-cyan-400 mb-4 glow-cyan">
          <ArrowRightLeft className="w-7 h-7 stroke-[2.5]" />
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white">
          Transfer Guest Session?
        </h2>

        <p className="text-xs sm:text-sm text-gray-400 mt-2">
          We found <strong className="text-white">{totalMatches} match {totalMatches === 1 ? 'record' : 'records'}</strong> ({completedCount} completed) from your current guest session.
        </p>

        <div className="my-5 p-4 rounded-2xl bg-gray-900/80 border border-gray-800 text-left text-xs space-y-2">
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Eligible completed songs will count toward your gem promotion</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Earned XP and best scores will be merged into your profile</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleTransfer}
            disabled={isSubmitting}
            className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg glow-cyan transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `Transfer ${totalMatches} Matches to My Account`
            )}
          </button>

          <button
            onClick={dismissTransferPrompt}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Discard Guest Matches
          </button>
        </div>
      </div>
    </div>
  );
};
