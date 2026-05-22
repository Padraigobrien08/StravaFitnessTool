"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceReplay,
  clampReplayTime,
  createReplayState,
} from "@/lib/route-intelligence/replay";
import type { ReplayState } from "@/lib/route-intelligence/types";

export function useRouteReplay(durationSec: number) {
  const [state, setState] = useState(() => createReplayState(durationSec));
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    setState((s) => ({
      ...s,
      durationSec: Math.max(1, durationSec),
      currentSec: Math.min(s.currentSec, durationSec),
    }));
  }, [durationSec]);

  useEffect(() => {
    if (!state.playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }

    lastRef.current = performance.now();
    const tick = (now: number) => {
      const delta = now - lastRef.current;
      lastRef.current = now;
      setState((s) => advanceReplay(s, delta));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [state.playing, state.speed]);

  const setTime = useCallback((sec: number) => {
    setState((s) => clampReplayTime(s, sec));
  }, []);

  const togglePlay = useCallback(() => {
    setState((s) => {
      if (s.currentSec >= s.durationSec - 0.5) {
        return { ...s, currentSec: 0, playing: true };
      }
      return { ...s, playing: !s.playing };
    });
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState((s) => ({ ...s, speed }));
  }, []);

  const pause = useCallback(() => {
    setState((s) => ({ ...s, playing: false }));
  }, []);

  return { state, setTime, togglePlay, setSpeed, pause, setState };
}
