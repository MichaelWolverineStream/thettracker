import type { DurationParts } from '../timerFormat';
import { units } from './shared';

const KEYCAP = '\uFE0F\u20E3';
const NOUNS = { hour: '🕐', minute: '⏱\uFE0F', second: '⚡' } as const;

export function emojiNumber(value: number): string {
  return String(value).split('').map((digit) => `${digit}${KEYCAP}`).join('');
}

export const emoji = {
  notStarted: '⏳👍',
  format: (parts: DurationParts) => units(parts).map(([count, unit]) => `${emojiNumber(count)}${NOUNS[unit]}`).join(' '),
};
