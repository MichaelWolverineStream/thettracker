import type { DurationParts } from '../timerFormat';
import { sentence, units } from './shared';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export const NOT_STARTED_WORDS = 'There is still time';

export function numberToWords(value: number): string {
  if (value < 20) return ONES[value];
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? `-${ONES[value % 10]}` : ''}`;
  if (value < 1000) return `${ONES[Math.floor(value / 100)]} hundred${value % 100 ? ` ${numberToWords(value % 100)}` : ''}`;
  return `${numberToWords(Math.floor(value / 1000))} thousand${value % 1000 ? ` ${numberToWords(value % 1000)}` : ''}`;
}

export const en = {
  notStarted: NOT_STARTED_WORDS,
  format: (parts: DurationParts) => sentence(units(parts).map(([count, unit]) => `${numberToWords(count)} ${unit}${count === 1 ? '' : 's'}`), 'and', true),
};
