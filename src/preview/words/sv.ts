import type { DurationParts } from '../timerFormat';
import { sentence, units } from './shared';

// "en" rather than "ett": timme, minut and sekund are all en-words.
const ONES = ['noll', 'en', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv', 'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton', 'nitton'];
const TENS = ['', '', 'tjugo', 'trettio', 'fyrtio', 'femtio', 'sextio', 'sjuttio', 'åttio', 'nittio'];
const NOUNS = { hour: ['timme', 'timmar'], minute: ['minut', 'minuter'], second: ['sekund', 'sekunder'] };

function belowHundred(value: number): string {
  if (value < 20) return ONES[value];
  return `${TENS[Math.floor(value / 10)]}${value % 10 ? ONES[value % 10] : ''}`;
}

export function swedishNumber(value: number): string {
  if (value >= 1000) return String(value);
  if (value < 100) return belowHundred(value);
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return `${hundreds === 1 ? '' : ONES[hundreds]}hundra${rest ? belowHundred(rest) : ''}`;
}

export const sv = {
  notStarted: 'Det finns fortfarande tid',
  format: (parts: DurationParts) => sentence(units(parts).map(([count, unit]) => `${swedishNumber(count)} ${NOUNS[unit][count === 1 ? 0 : 1]}`), 'och'),
};
