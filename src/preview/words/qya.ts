import type { DurationParts } from '../timerFormat';
import { sentence, units } from './shared';

// nelquë (13) and the tens are scholarly reconstructions, not attested forms.
const ONES = ['', 'min', 'atta', 'neldë', 'canta', 'lempë', 'enquë', 'otso', 'tolto', 'nertë', 'quëan', 'minquë', 'yunquë', 'nelquë', 'canquë', 'lepenquë', 'enenquë', 'otoquë', 'tolquë', 'neterquë'];
const TENS = ['', '', 'yuquain', 'nelquain', 'canquain', 'lepenquain', 'enenquain', 'otoquain', 'tolquain', 'neterquain'];
// Tolkien left no words for minute or second. These coinages mirror the Latin
// origin of the English words: "a sixtieth" and "a second sixtieth".
const NOUNS = { hour: ['lúmë', 'lúmi'], minute: ['enenquaista', 'enenquaistar'], second: ['attëa enenquaista', 'attië enenquaistar'] } as const;

// Smaller units come first (min yuquain = 21); hundreds stay as digits.
export function quenyaNumber(value: number): string {
  if (value >= 100) return String(value);
  if (value < 20) return ONES[value];
  return [ONES[value % 10], TENS[Math.floor(value / 10)]].filter(Boolean).join(' ');
}

export const qya = {
  notStarted: "Elen síla lúmenn' omentielvo",
  format: (parts: DurationParts) => sentence(units(parts).map(([count, unit]) => {
    const [singular, plural] = NOUNS[unit];
    if (count === 1) return `min ${singular}`;
    if (count === 2) return `${singular} atta`;
    return `${plural} ${quenyaNumber(count)}`;
  }), 'ar'),
};
