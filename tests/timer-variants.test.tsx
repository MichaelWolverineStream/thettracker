import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAUNCH_SETTINGS } from '../src/preview/config';
import { TIMER_VARIANTS, resolveAppearance, type TimerVariant } from '../src/preview/appearance';
import { NOT_STARTED_WORDS, formatClock, formatCompact, formatRoman, formatWords, numberToWords, splitDuration, timerText, toRoman } from '../src/preview/timerFormat';
import TimerFace from '../src/preview/components/TimerFace';

const fixture = vi.hoisted(() => ({
  data: { status: 'Connected', maxChecks: 216, checkCount: 55, bonks: 2, chestTurns: 11, deaths: 1, rupees: 500, screens: 120, damage: 127, magic: 240 },
  timer: { duration: 3842000, startAt: 0, timeStarted: 0 },
  hasStarted: true,
}));

vi.mock('../src/preview/autotrack', () => ({ default: () => fixture.data }));
vi.mock('../src/preview/components/timer', () => ({ default: () => ({ ...fixture.timer, hasStarted: fixture.hasStarted }) }));

import PreviewApp from '../src/preview/App';

const time = (hours: number, minutes: number, seconds: number) => ((hours * 60 + minutes) * 60 + seconds) * 1000;

afterEach(() => {
  cleanup();
  fixture.timer.duration = 3842000;
  fixture.hasStarted = true;
});

describe('timer text formats', () => {
  it('splits durations into floored, unbounded units', () => {
    expect(splitDuration(0)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    expect(splitDuration(999)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    expect(splitDuration(time(1, 4, 3) + 999)).toEqual({ hours: 1, minutes: 4, seconds: 3 });
    expect(splitDuration(time(25, 0, 1))).toEqual({ hours: 25, minutes: 0, seconds: 1 });
  });

  it('keeps the digital clock format and its 24 hour wrap', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(time(1, 4, 3))).toBe('01:04:03');
    expect(formatClock(time(25, 0, 1))).toBe('01:00:01');
  });

  it.each([
    [0, 'zero'], [7, 'seven'], [13, 'thirteen'], [20, 'twenty'], [42, 'forty-two'], [99, 'ninety-nine'],
    [100, 'one hundred'], [121, 'one hundred twenty-one'], [1000, 'one thousand'], [2305, 'two thousand three hundred five'],
  ])('spells %i as %s', (value, expected) => {
    expect(numberToWords(value)).toBe(expected);
  });

  it.each([
    [0, NOT_STARTED_WORDS],
    [time(0, 0, 1), 'One second'],
    [time(0, 0, 3), 'Three seconds'],
    [time(0, 1, 0), 'One minute'],
    [time(0, 4, 3), 'Four minutes and three seconds'],
    [time(1, 0, 0), 'One hour'],
    [time(1, 0, 1), 'One hour and one second'],
    [time(2, 30, 0), 'Two hours and thirty minutes'],
    [time(1, 4, 3), 'One hour, four minutes, and three seconds'],
    [time(23, 59, 59), 'Twenty-three hours, fifty-nine minutes, and fifty-nine seconds'],
    [time(25, 0, 1), 'Twenty-five hours and one second'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(formatWords(splitDuration(ms))).toBe(expected);
    expect(timerText('words', ms)).toBe(expected);
  });

  it.each([
    [0, '0s'], [time(0, 0, 3), '3s'], [time(0, 4, 3), '4m 03s'], [time(1, 4, 3), '1h 04m 03s'], [time(25, 0, 0), '25h 00m 00s'],
  ])('compacts %i ms as %s', (ms, expected) => {
    expect(formatCompact(splitDuration(ms))).toBe(expected);
    expect(timerText('compact', ms)).toBe(expected);
  });

  it('writes roman numerals with an em dash for empty units', () => {
    expect(toRoman(0)).toBe('—');
    expect([4, 9, 14, 40, 59, 90, 400, 1994].map(toRoman)).toEqual(['IV', 'IX', 'XIV', 'XL', 'LIX', 'XC', 'CD', 'MCMXCIV']);
    expect(formatRoman(splitDuration(0))).toBe('—:—:—');
    expect(formatRoman(splitDuration(time(0, 4, 3)))).toBe('—:IV:III');
    expect(timerText('roman', time(1, 4, 3))).toBe('I:IV:III');
    expect(timerText('roman', time(23, 59, 59))).toBe('XXIII:LIX:LIX');
  });

  it.each(['digital', 'analog', 'lcd', 'rings', 'binary', 'flip'] as const)('uses the digital clock text for %s', (variant) => {
    expect(timerText(variant, time(1, 4, 3))).toBe('01:04:03');
  });
});

describe('timer faces', () => {
  const ms = time(1, 4, 3);

  it('renders digital as bare text', () => {
    const view = render(<h2><TimerFace variant="digital" ms={ms} /></h2>);
    expect(view.container.querySelector('h2')!.innerHTML).toBe('01:04:03');
  });

  it.each([['words', 'One hour, four minutes, and three seconds'], ['compact', '1h 04m 03s'], ['roman', 'I:IV:III'], ['flip', '01:04:03']] as const)('renders %s as text', (variant, expected) => {
    const view = render(<h2><TimerFace variant={variant} ms={ms} /></h2>);
    expect(view.container.textContent).toBe(expected);
  });

  it('positions analog hands from hours, minutes and ticking seconds', () => {
    const view = render(<TimerFace variant="analog" ms={ms + 999} />);
    const hand = (name: string) => view.container.querySelector(`[data-hand="${name}"]`)!.getAttribute('transform');
    expect(view.getByRole('img', { name: '01:04:03' })).toBeTruthy();
    expect(hand('hour')).toBe(`rotate(${30 + 2 + 3 / 120} 50 50)`);
    expect(hand('minute')).toBe(`rotate(${24 + 3 / 10} 50 50)`);
    expect(hand('second')).toBe('rotate(18 50 50)');
    expect(view.container.querySelectorAll('text')).toHaveLength(4);
    view.rerender(<TimerFace variant="analog" ms={time(13, 0, 0)} />);
    expect(hand('hour')).toBe('rotate(30 50 50)');
  });

  it('lights the matching seven segments', () => {
    const view = render(<TimerFace variant="lcd" ms={ms} />);
    expect(view.getByRole('img', { name: '01:04:03' })).toBeTruthy();
    const digits = view.container.querySelectorAll('[data-digit]');
    expect([...digits].map((digit) => digit.getAttribute('data-digit'))).toEqual(['0', '1', '0', '4', '0', '3']);
    const lit = (index: number) => [...digits[index].querySelectorAll('[data-segment]')].filter((segment) => segment.getAttribute('opacity') === '1').map((segment) => segment.getAttribute('data-segment')).join('');
    expect([0, 1, 3, 5].map(lit)).toEqual(['abcdef', 'bc', 'bcfg', 'abcdg']);
  });

  it('fills progress rings and draws only tracks before any progress', () => {
    const view = render(<TimerFace variant="rings" ms={ms} />);
    const fraction = (name: string) => Number(view.container.querySelector(`[data-ring="${name}"]`)!.getAttribute('data-fraction'));
    expect(view.getByRole('img', { name: '01:04:03' })).toBeTruthy();
    expect(fraction('seconds')).toBeCloseTo(3 / 60);
    expect(fraction('minutes')).toBeCloseTo((4 + 3 / 60) / 60);
    expect(fraction('hours')).toBeCloseTo((1 + 4 / 60) / 12);
    expect(view.container.querySelectorAll('circle')).toHaveLength(6);
    view.rerender(<TimerFace variant="rings" ms={0} />);
    expect(view.container.querySelectorAll('circle')).toHaveLength(3);
  });

  it('encodes each clock digit in binary columns', () => {
    const view = render(<TimerFace variant="binary" ms={time(23, 59, 59)} />);
    expect(view.getByRole('img', { name: '23:59:59' })).toBeTruthy();
    const columns = [...view.container.querySelectorAll('[data-digit]')];
    expect(columns.map((column) => column.querySelectorAll('[data-bit]').length)).toEqual([2, 4, 3, 4, 3, 4]);
    const lit = columns.map((column) => [...column.querySelectorAll('[data-bit]')].filter((bit) => bit.getAttribute('opacity') === '1').reduce((sum, bit) => sum + Number(bit.getAttribute('data-bit')), 0));
    expect(lit).toEqual([2, 3, 5, 9, 5, 9]);
  });

  it('remounts only the flip cards whose digit changed', () => {
    const view = render(<TimerFace variant="flip" ms={ms} />);
    const digits = () => [...view.container.querySelectorAll('.timer-flip-digit')];
    const before = digits();
    expect(before).toHaveLength(6);
    expect(view.container.querySelectorAll('.timer-flip-colon')).toHaveLength(2);
    view.rerender(<TimerFace variant="flip" ms={ms + 1000} />);
    const after = digits();
    after.slice(0, 5).forEach((digit, index) => expect(digit).toBe(before[index]));
    expect(after[5]).not.toBe(before[5]);
    expect(after[5].textContent).toBe('4');
  });

  it('scales graphic faces', () => {
    const view = render(<TimerFace variant="analog" ms={ms} scale={0.5} />);
    expect(view.container.querySelector('svg')!.getAttribute('width')).toBe('80');
  });
});

describe('preview tracker timer variants', () => {
  const renderVariant = (variant: TimerVariant, font = 'bungee') => {
    const appearance = resolveAppearance({ timer: { color: '#123456', font, variant } });
    const view = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" appearance={appearance} />);
    return { view, timer: view.container.querySelector('h2')! };
  };

  it.each(TIMER_VARIANTS)('renders $label with the timer color and compensated duration', ({ value, usesFont, layout }) => {
    const { view, timer } = renderVariant(value);
    expect(timer.style.color).toBe('rgb(18, 52, 86)');
    expect(timer.style.fontFamily !== '').toBe(usesFont);
    expect(timer.style.whiteSpace).toBe(layout === 'line' && value !== 'digital' ? 'nowrap' : '');
    if (layout === 'graphic') expect(view.getByRole('img', { name: '01:04:03' })).toBeTruthy();
    else expect(timer.textContent).toBe(timerText(value, time(1, 4, 3)));
    expect(view.getByText('DE-FLUFF')).toBeTruthy();
  });

  it.each([['words', NOT_STARTED_WORDS], ['compact', '0s'], ['roman', '—:—:—'], ['digital', '00:00:00'], ['flip', '00:00:00']] as const)('shows the not-started %s state', (variant, expected) => {
    fixture.hasStarted = false;
    fixture.timer.duration = 0;
    expect(renderVariant(variant).timer.textContent).toBe(expected);
  });

  it('keeps hours beyond a day in text variants but wraps digit variants', () => {
    fixture.timer.duration = time(25, 0, 0);
    expect(renderVariant('words').timer.textContent).toBe('Twenty-five hours and one second');
    cleanup();
    expect(renderVariant('roman').timer.textContent).toBe('XXV:—:I');
    cleanup();
    expect(renderVariant('digital').timer.textContent).toBe('01:00:01');
  });

  it('renders the words language with a lang attribute', () => {
    const renderWords = () => {
      const appearance = resolveAppearance({ timer: { color: '#123456', font: 'bungee', variant: 'words', language: 'ko' } });
      return render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" appearance={appearance} />).container.querySelector('h2 .timer-face-words')!;
    };
    const words = renderWords();
    expect(words.getAttribute('lang')).toBe('ko');
    expect(words.textContent).toBe('한 시간 사 분 삼 초');
    cleanup();
    fixture.hasStarted = false;
    fixture.timer.duration = 0;
    expect(renderWords().textContent).toBe('아직 시간이 있어요');
    cleanup();
    expect(renderVariant('words').timer.querySelector('.timer-face-words')!.getAttribute('lang')).toBe('en');
  });
});
