import type { TimerVariant } from './appearance';

export interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const;

export const NOT_STARTED_WORDS = 'There is still time';

// Matches the digital timer, including its wrap after 24 hours.
export function formatClock(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}

export function splitDuration(ms: number): DurationParts {
  const total = Math.floor(ms / 1000);
  return { hours: Math.floor(total / 3600), minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}

export function numberToWords(value: number): string {
  if (value < 20) return ONES[value];
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? `-${ONES[value % 10]}` : ''}`;
  if (value < 1000) return `${ONES[Math.floor(value / 100)]} hundred${value % 100 ? ` ${numberToWords(value % 100)}` : ''}`;
  return `${numberToWords(Math.floor(value / 1000))} thousand${value % 1000 ? ` ${numberToWords(value % 1000)}` : ''}`;
}

export function formatWords({ hours, minutes, seconds }: DurationParts): string {
  const units = ([[hours, 'hour'], [minutes, 'minute'], [seconds, 'second']] as const)
    .filter(([count]) => count > 0)
    .map(([count, unit]) => `${numberToWords(count)} ${unit}${count === 1 ? '' : 's'}`);
  if (units.length === 0) return NOT_STARTED_WORDS;
  const phrase = units.length === 3 ? `${units[0]}, ${units[1]}, and ${units[2]}` : units.join(' and ');
  return phrase[0].toUpperCase() + phrase.slice(1);
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

export function timerText(variant: TimerVariant, ms: number): string {
  if (variant === 'words') return formatWords(splitDuration(ms));
  if (variant === 'compact') return formatCompact(splitDuration(ms));
  if (variant === 'roman') return formatRoman(splitDuration(ms));
  return formatClock(ms);
}
