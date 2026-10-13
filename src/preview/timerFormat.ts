import type { TimerLanguage, TimerVariant } from './appearance';
import { WORDS } from './words';

export { NOT_STARTED_WORDS, numberToWords } from './words/en';

export interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
}

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const;

// Matches the digital timer, including its wrap after 24 hours.
export function formatClock(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}

export function splitDuration(ms: number): DurationParts {
  const total = Math.floor(ms / 1000);
  return { hours: Math.floor(total / 3600), minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}

export function formatWords(parts: DurationParts, language: TimerLanguage = 'en'): string {
  const words = WORDS[language];
  return parts.hours + parts.minutes + parts.seconds === 0 ? words.notStarted : words.format(parts);
}

export function formatCompact({ hours, minutes, seconds }: DurationParts): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

export function toRoman(value: number): string {
  if (value === 0) return '—';
  let rest = value;
  let numeral = '';
  for (const [amount, symbol] of ROMAN) {
    while (rest >= amount) {
      numeral += symbol;
      rest -= amount;
    }
  }
  return numeral;
}

export function formatRoman({ hours, minutes, seconds }: DurationParts): string {
  return [hours, minutes, seconds].map(toRoman).join(':');
}

export function timerText(variant: TimerVariant, ms: number, language: TimerLanguage = 'en'): string {
  if (variant === 'words') return formatWords(splitDuration(ms), language);
  if (variant === 'compact') return formatCompact(splitDuration(ms));
  if (variant === 'roman') return formatRoman(splitDuration(ms));
  return formatClock(ms);
}
