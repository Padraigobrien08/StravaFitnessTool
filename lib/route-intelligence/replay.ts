import type { ReplayState } from "./types";

export type { ReplayState };

export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8] as const;

export function createReplayState(durationSec: number): ReplayState {
  return {
    currentSec: 0,
    playing: false,
    speed: 1,
    durationSec: Math.max(1, durationSec),
  };
}

export function advanceReplay(
  state: ReplayState,
  deltaMs: number
): ReplayState {
  if (!state.playing) return state;
  const advance = (deltaMs / 1000) * state.speed;
  let next = state.currentSec + advance;
  if (next >= state.durationSec) {
    return { ...state, currentSec: state.durationSec, playing: false };
  }
  return { ...state, currentSec: next };
}

export function clampReplayTime(state: ReplayState, sec: number): ReplayState {
  return {
    ...state,
    currentSec: Math.max(0, Math.min(state.durationSec, sec)),
  };
}

export function formatReplayClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
