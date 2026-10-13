import type { DurationParts } from '../timerFormat';
import { sentence, units } from './shared';

// Feminine forms throughout: heure, minute and seconde are all feminine.
const ONES = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
const NOUNS = { hour: 'heure', minute: 'minute', second: 'seconde' };

function belowHundred(value: number): string {
  if (value < 20) return ONES[value];
  if (value < 70) {
    const tens = TENS[Math.floor(value / 10)];
    const unit = value % 10;
    return unit === 0 ? tens : unit === 1 ? `${tens} et une` : `${tens}-${ONES[unit]}`;
  }
  if (value < 80) return value === 71 ? 'soixante et onze' : `soixante-${ONES[value - 60]}`;
  return value === 80 ? 'quatre-vingts' : `quatre-vingt-${ONES[value - 80]}`;
}

export function frenchNumber(value: number): string {
  if (value >= 1000) return String(value);
  if (value < 100) return belowHundred(value);
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const head = hundreds === 1 ? 'cent' : `${ONES[hundreds]} cent${rest === 0 ? 's' : ''}`;
  return rest === 0 ? head : `${head} ${belowHundred(rest)}`;
}

export const fr = {
  notStarted: 'Il est encore temps',
  format: (parts: DurationParts) => sentence(units(parts).map(([count, unit]) => `${frenchNumber(count)} ${NOUNS[unit]}${count > 1 ? 's' : ''}`), 'et'),
};
