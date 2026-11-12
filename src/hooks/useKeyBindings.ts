/**
 * useKeyBindings — Configurable keyboard controls for PraiseTiles gameplay.
 *
 * Resolves GDD Open Decision #4: remappable keyboard controls.
 * Stores custom key bindings in localStorage under 'praisetiles_key_bindings'.
 * Defaults to the canonical D/F/J/K layout specified in GAMEPLAY_CONFIG.
 *
 * Phase 8: GDD Reconciliation
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { safeLocalStorage } from '@/lib/storage/safeStorage';

const STORAGE_KEY = 'praisetiles_key_bindings';
const DEFAULT_KEYS = [...GAMEPLAY_CONFIG.LANES.DEFAULT_KEYS];
const LANE_COUNT = GAMEPLAY_CONFIG.LANES.COUNT;

/**
 * Validates that a key binding array meets requirements:
 * - Exactly LANE_COUNT entries.
 * - All are non-empty lowercase single characters.
 * - No duplicates.
 */
function isValidBindings(keys: string[]): boolean {
  if (!Array.isArray(keys) || keys.length !== LANE_COUNT) return false;
  const seen = new Set<string>();
  for (const k of keys) {
    if (typeof k !== 'string' || k.length !== 1) return false;
    const lower = k.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
  }
  return true;
}

/**
 * Loads saved key bindings from localStorage, falling back to defaults.
 */
function loadBindings(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_KEYS];
  try {
    const stored = safeLocalStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidBindings(parsed)) {
        return parsed.map((k: string) => k.toLowerCase());
      }
    }
  } catch {
    // Corrupted data — fall back silently
  }
  return [...DEFAULT_KEYS];
}

/**
 * Persists key bindings to localStorage.
 */
function saveBindings(keys: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage full or unavailable — non-critical
  }
}

export interface KeyBindingsState {
  /** Current key bindings [lane0, lane1, lane2, lane3] */
  keys: string[];
  /** Update a single lane's key binding */
  setKey: (lane: number, key: string) => void;
  /** Reset all bindings to D/F/J/K defaults */
  resetToDefaults: () => void;
  /** Whether current bindings differ from defaults */
  isCustom: boolean;
  /** Resolve a pressed key to its lane index, or -1 if not mapped */
  keyToLane: (key: string) => number;
}

/**
 * React hook for managing configurable keyboard key bindings.
 */
export function useKeyBindings(): KeyBindingsState {
  const [keys, setKeys] = useState<string[]>(loadBindings);

  // Persist whenever bindings change
  useEffect(() => {
    saveBindings(keys);
  }, [keys]);

  const setKey = useCallback((lane: number, key: string) => {
    if (lane < 0 || lane >= LANE_COUNT) return;
    const normalized = key.toLowerCase();
    if (normalized.length !== 1) return;

    setKeys((prev) => {
      const next = [...prev];
      // If this key is already assigned to another lane, swap them
      const existingLane = next.indexOf(normalized);
      if (existingLane !== -1 && existingLane !== lane) {
        next[existingLane] = next[lane];
      }
      next[lane] = normalized;
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setKeys([...DEFAULT_KEYS]);
  }, []);

  const isCustom = keys.some((k, i) => k !== DEFAULT_KEYS[i]);

  const keyToLane = useCallback(
    (key: string): number => {
      return keys.indexOf(key.toLowerCase());
    },
    [keys]
  );

  return { keys, setKey, resetToDefaults, isCustom, keyToLane };
}
