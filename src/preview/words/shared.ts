import type { DurationParts } from '../timerFormat';

// Non-zero units in reading order.
export function units({ hours, minutes, seconds }: DurationParts) {
  return ([[hours, 'hour'], [minutes, 'minute'], [seconds, 'second']] as const).filter(([count]) => count > 0);
}

export function sentence(phrases: string[], conjunction: string, oxford = false): string {
  const text = phrases.length < 3
    ? phrases.join(` ${conjunction} `)
    : `${phrases.slice(0, -1).join(', ')}${oxford ? ',' : ''} ${conjunction} ${phrases[phrases.length - 1]}`;
  return text[0].toUpperCase() + text.slice(1);
}
