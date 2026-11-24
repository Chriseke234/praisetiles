'use client';

/**
 * PauseTasksCard — Displays active player tasks and daily praise challenges
 * within the in-game Pause modal across Solo and Practice gameplay modes.
 * 
 * Features:
 * - Live challenge state via loadPlayerChallenges()
 * - Visual progress bar per active task with target milestones
 * - XP reward pills with crisp SVG icons (no emojis)
 * - Compact, scrollable card fitting mobile and desktop pause modals
 */

import React, { useState, useEffect } from 'react';
import { Challenge, loadPlayerChallenges } from '@/lib/progression/challenges';
import { Sparkles, CheckCircle2, Target } from 'lucide-react';

export const PauseTasksCard: React.FC = () => {
  const [tasks, setTasks] = useState<Challenge[]>([]);

  useEffect(() => {
    try {
      const all = loadPlayerChallenges();
      // Show daily challenges first, up to 3 active tasks
      const active = all.filter((c) => c.period === 'daily').slice(0, 3);
      setTasks(active.length > 0 ? active : all.slice(0, 3));
    } catch {
      // Non-blocking fallback
    }
  }, []);

  if (tasks.length === 0) return null;

  return (
    <div className="w-full bg-purple-950/30 border border-purple-500/20 rounded-2xl p-3 text-left space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Active Praise Tasks
        </span>
        <span className="text-[10px] font-mono text-gray-400">
          {tasks.filter((t) => t.completed).length}/{tasks.length} Done
        </span>
      </div>

      <div className="space-y-2 max-h-36 overflow-y-auto pr-0.5 scrollbar-thin">
        {tasks.map((task) => {
          const percent = Math.min(100, Math.round((task.currentValue / task.targetValue) * 100));
          return (
            <div
              key={task.id}
              className="p-2 rounded-xl bg-[#0e0720]/80 border border-purple-500/15 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {task.completed ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Target className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                    <h4 className="text-[11px] font-bold text-gray-200 truncate">
                      {task.title}
                    </h4>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight truncate">
                    {task.description}
                  </p>
                </div>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                  +{task.xpReward} XP
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[9px] font-mono text-gray-400">
                  <span>{task.completed ? 'Completed' : 'In Progress'}</span>
                  <span>
                    {task.currentValue.toLocaleString()} / {task.targetValue.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      task.completed
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
