'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { X, Lock, Mail, User, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'signin',
}) => {
  const { signIn, signUp, isSupabaseAvailable } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to sign in. Please verify your credentials.');
        } else {
          onClose();
        }
      } else {
        const res = await signUp(email, password, username, displayName);
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to create account.');
        } else {
          onClose();
        }
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-gray-950 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 mx-auto flex items-center justify-center text-amber-400 mb-3">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-black text-white">
            {mode === 'signin' ? 'Welcome Back' : 'Create Praise Profile'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {mode === 'signin'
              ? 'Sign in to access your gem rank, stats, and match history.'
              : 'Register to unlock persistent progression across devices.'}
          </p>
        </div>

        {/* Supabase Unconfigured Notice */}
        {!isSupabaseAvailable && (
          <div className="mb-5 p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p>
              Supabase project is not yet configured with live credentials. You can continue playing in guest mode with full features!
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-gray-900 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              mode === 'signin'
                ? 'bg-amber-500 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              mode === 'signup'
                ? 'bg-amber-500 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Username (Unique)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="gospel_warrior"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 focus:border-amber-500 focus:outline-none text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Brother David"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 focus:border-amber-500 focus:outline-none text-white text-xs"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="praiser@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 focus:border-amber-500 focus:outline-none text-white text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 focus:border-amber-500 focus:outline-none text-white text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg glow-gold transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Continue as Guest */}
        <div className="mt-5 pt-4 border-t border-gray-900 text-center">
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white transition font-medium"
          >
            Continue as Guest without signing in
          </button>
        </div>
      </div>
    </div>
  );
};
