import type { DurationParts } from '../timerFormat';
import { units } from './shared';

const DIGITS = ['', "wa'", "cha'", 'wej', 'loS', 'vagh', 'jav', 'Soch', 'chorgh', 'Hut'];
const POWERS = [[100, 'vatlh'], [10, 'maH'], [1, '']] as const;
const NOUNS = { hour: 'rep', minute: 'tup', second: 'lup' } as const;

// Larger powers come first: cha'maH wa' = 21.
export function klingonNumber(value: number): string {
  if (value >= 1000) return String(value);
  return POWERS.map(([power, suffix]) => [Math.floor(value / power) % 10, suffix] as const)
    .filter(([digit]) => digit > 0)
    .map(([digit, suffix]) => `${DIGITS[digit]}${suffix}`)
    .join(' ');
}

// Case is phonemic in Klingon, so nothing is capitalised. Nouns take no plural
// suffix after a number, and the noun conjunction je follows the last noun.
export const tlh = {
  notStarted: "poH tu'lu'",
  format: (parts: DurationParts) => {
    const phrases = units(parts).map(([count, unit]) => `${klingonNumber(count)} ${NOUNS[unit]}`);
    return phrases.length > 1 ? `${phrases.join(' ')} je` : phrases[0];
  },
};
