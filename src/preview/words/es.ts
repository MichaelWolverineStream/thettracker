import type { DurationParts } from '../timerFormat';
import { sentence, units } from './shared';

type Gender = 'f' | 'm';

const ONES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscient', 'trescient', 'cuatrocient', 'quinient', 'seiscient', 'setecient', 'ochocient', 'novecient'];
const NOUNS = { hour: ['hora', 'horas', 'f'], minute: ['minuto', 'minutos', 'm'], second: ['segundo', 'segundos', 'm'] } as const;

function belowHundred(value: number): string {
  if (value < 30) return ONES[value];
  return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` y ${ONES[value % 10]}` : ''}`;
}

// A final "uno" agrees with the noun: una hora, un minuto, veintiún minutos.
function agree(words: string, gender: Gender): string {
  if (words.endsWith('veintiuno')) return `${words.slice(0, -3)}${gender === 'f' ? 'una' : 'ún'}`;
  if (words === 'uno' || words.endsWith(' uno')) return `${words.slice(0, -3)}${gender === 'f' ? 'una' : 'un'}`;
  return words;
}

export function spanishNumber(value: number, gender: Gender): string {
  if (value >= 1000) return String(value);
  if (value === 100) return 'cien';
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds === 0) return agree(belowHundred(rest), gender);
  const head = hundreds === 1 ? HUNDREDS[1] : `${HUNDREDS[hundreds]}${gender === 'f' ? 'as' : 'os'}`;
  return agree(rest ? `${head} ${belowHundred(rest)}` : head, gender);
}

export const es = {
  notStarted: 'Todavía hay tiempo',
  format: (parts: DurationParts) => sentence(units(parts).map(([count, unit]) => {
    const [singular, plural, gender] = NOUNS[unit];
    return `${spanishNumber(count, gender)} ${count === 1 ? singular : plural}`;
  }), 'y'),
};
