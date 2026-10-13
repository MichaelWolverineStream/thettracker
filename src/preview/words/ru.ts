import type { DurationParts } from '../timerFormat';
import { sentence, units } from './shared';

type Gender = 'm' | 'f';

const GENDERED = { m: ['', 'один', 'два'], f: ['', 'одна', 'две'] };
const ONES = ['', '', '', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
// [one, few, many] forms plus grammatical gender.
const NOUNS = { hour: ['час', 'часа', 'часов', 'm'], minute: ['минута', 'минуты', 'минут', 'f'], second: ['секунда', 'секунды', 'секунд', 'f'] } as const;

function belowTwenty(value: number, gender: Gender): string {
  return value <= 2 ? GENDERED[gender][value] : ONES[value];
}

export function russianNumber(value: number, gender: Gender): string {
  if (value >= 1000) return String(value);
  const rest = value % 100;
  return [HUNDREDS[Math.floor(value / 100)], rest >= 20 ? TENS[Math.floor(rest / 10)] : '', belowTwenty(rest >= 20 ? rest % 10 : rest, gender)].filter(Boolean).join(' ');
}

// 0 = one (1, 21), 1 = few (2–4, 22–24), 2 = many (5–20, 25–30, 11–14).
export function russianPluralForm(value: number): 0 | 1 | 2 {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 2;
  if (last === 1) return 0;
  return last >= 2 && last <= 4 ? 1 : 2;
}

export const ru = {
  notStarted: 'Ещё есть время',
  format: (parts: DurationParts) => sentence(units(parts).map(([count, unit]) => {
    const [one, few, many, gender] = NOUNS[unit];
    return `${russianNumber(count, gender)} ${[one, few, many][russianPluralForm(count)]}`;
  }), 'и'),
};
