import { useEffect, useState } from "react";
import type { PhaseTiming } from "../../shared/waiting-room";

export function getRemainingPhaseSeconds(
  timing: PhaseTiming,
  currentTime = Date.now(),
): number {
  const remainingMilliseconds =
    timing.startedAt + timing.durationMs - currentTime;

  return Math.max(0, Math.ceil(remainingMilliseconds / 1_000));
}

export function useRemainingPhaseSeconds(
  timing: PhaseTiming | undefined,
): number | null {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!timing) {
      return;
    }

    const updateCurrentTime = () => setCurrentTime(Date.now());
    const timeoutId = globalThis.setTimeout(updateCurrentTime, 0);
    const intervalId = globalThis.setInterval(() => {
      updateCurrentTime();
    }, 250);

    return () => {
      globalThis.clearTimeout(timeoutId);
      globalThis.clearInterval(intervalId);
    };
  }, [timing]);

  return timing ? getRemainingPhaseSeconds(timing, currentTime) : null;
}
