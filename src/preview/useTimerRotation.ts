import { useEffect, useState } from 'react';
import type { TimerVariant } from './appearance';

export const ROTATION_MIN_MS = 10_000;
export const ROTATION_MAX_MS = 100_000;

function pick(styles: readonly TimerVariant[]) {
  return styles[Math.floor(Math.random() * styles.length)];
}

// `styles` must be referentially stable, or every render restarts the countdown.
export function useTimerRotation(styles: readonly TimerVariant[], running: boolean): TimerVariant {
  const [current, setCurrent] = useState(() => pick(styles));

  useEffect(() => {
    if (!running || styles.length < 2) return;
    const timeout = setTimeout(() => {
      setCurrent(pick(styles.filter((style) => style !== current)));
    }, ROTATION_MIN_MS + Math.random() * (ROTATION_MAX_MS - ROTATION_MIN_MS));
    return () => clearTimeout(timeout);
  }, [running, current, styles]);

  return current;
}
