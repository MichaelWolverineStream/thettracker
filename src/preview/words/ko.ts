import type { DurationParts } from '../timerFormat';
import { units } from './shared';

const NATIVE_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const SINO_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

// Counter forms used before 시간; native numbers stop at 99.
export function nativeKoreanCount(value: number): string {
  if (value === 20) return '스무';
  return `${NATIVE_TENS[Math.floor(value / 10)]}${NATIVE_ONES[value % 10]}`;
}

export function sinoKoreanNumber(value: number): string {
  if (value >= 1000) return String(value);
  const place = (digit: number, suffix: string) => digit === 0 ? '' : `${digit === 1 ? '' : SINO_DIGITS[digit]}${suffix}`;
  return `${place(Math.floor(value / 100), '백')}${place(Math.floor(value / 10) % 10, '십')}${SINO_DIGITS[value % 10]}`;
}

export const ko = {
  notStarted: '아직 시간이 있어요',
  format: (parts: DurationParts) => units(parts).map(([count, unit]) => {
    if (unit === 'hour') return `${count < 100 ? nativeKoreanCount(count) : sinoKoreanNumber(count)} 시간`;
    return `${sinoKoreanNumber(count)} ${unit === 'minute' ? '분' : '초'}`;
  }).join(' '),
};
