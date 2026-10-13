import type { DurationParts } from '../timerFormat';
import { sentence, units } from './shared';

type Gender = 'f' | 'n';

const DECLINED = { f: ['', 'una', 'duae', 'tres'], n: ['', 'unum', 'duo', 'tria'] };
const ONES = ['', '', '', '', 'quattuor', 'quinque', 'sex', 'septem', 'octo', 'novem', 'decem', 'undecim', 'duodecim', 'tredecim', 'quattuordecim', 'quindecim', 'sedecim', 'septendecim'];
const TENS = ['', 'decem', 'viginti', 'triginta', 'quadraginta', 'quinquaginta', 'sexaginta', 'septuaginta', 'octoginta', 'nonaginta'];
const HUNDREDS = ['', 'centum', 'ducent', 'trecent', 'quadringent', 'quingent', 'sescent', 'septingent', 'octingent', 'nongent'];
const NOUNS = { hour: ['hora', 'horae', 'f'], minute: ['minutum', 'minuta', 'n'], second: ['secundum', 'secunda', 'n'] } as const;

function small(value: number, gender: Gender): string {
  return value <= 3 ? DECLINED[gender][value] : ONES[value];
}

function belowHundred(value: number, gender: Gender): string {
  if (value < 18) return small(value, gender);
  const tens = Math.floor(value / 10);
  const unit = value % 10;
  // Subtractive forms (duodeviginti, undeviginti, ...) stop below ninety.
  if (unit >= 8 && tens < 9) return `${unit === 8 ? 'duode' : 'unde'}${TENS[tens + 1]}`;
  return unit === 0 ? TENS[tens] : `${TENS[tens]} ${small(unit, gender)}`;
}

export function latinNumber(value: number, gender: Gender): string {
  if (value >= 1000) return String(value);
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const head = hundreds === 0 ? '' : hundreds === 1 ? HUNDREDS[1] : `${HUNDREDS[hundreds]}${gender === 'f' ? 'ae' : 'a'}`;
  return [head, rest ? belowHundred(rest, gender) : ''].filter(Boolean).join(' ');
}

export const la = {
  notStarted: 'Adhuc tempus est',
  format: (parts: DurationParts) => sentence(units(parts).map(([count, unit]) => {
    const [singular, plural, gender] = NOUNS[unit];
    return `${latinNumber(count, gender)} ${count === 1 ? singular : plural}`;
  }), 'et'),
};
