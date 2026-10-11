import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAUNCH_SETTINGS } from '../src/preview/config';

const fixture = vi.hoisted(() => ({
  data: { status: 'Connected', maxChecks: 216, checkCount: 55, bonks: 2, chestTurns: 11, deaths: 1, rupees: 500, screens: 120, damage: 127, magic: 240 },
  timer: { duration: 3600000, startAt: 0, timeStarted: 0 },
}));

vi.mock('../src/legacy/autotrack', () => ({ default: () => fixture.data }));
vi.mock('../src/preview/autotrack', () => ({ default: () => fixture.data }));
vi.mock('../src/legacy/components/timer', () => ({ default: () => fixture.timer }));
vi.mock('../src/preview/components/timer', () => ({ default: () => fixture.timer }));

import LegacyApp from '../src/legacy/App';
import PreviewApp from '../src/preview/App';

afterEach(() => {
  cleanup();
  fixture.timer.duration = 3600000;
});

describe('finite-time tracker parity', () => {
  it.each([216, 500])('preserves metric markup, counts, formulas and palettes with maxChecks %i', (maxChecks) => {
    fixture.data.maxChecks = maxChecks;
    const legacy = render(<LegacyApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" />);
    const expected = legacy.container.innerHTML;
    legacy.unmount();
    const preview = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" />);
    expect(preview.container.innerHTML).toBe(expected);
  });

  it.each([1000, 30000])('preserves every formula at %i ms', (duration) => {
    fixture.timer.duration = duration;
    const legacy = render(<LegacyApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" />);
    const expected = legacy.container.innerHTML;
    legacy.unmount();
    expect(render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" />).container.innerHTML).toBe(expected);
  });

  it('uses zero startup rates with valid colors even when counts are nonzero', () => {
    fixture.timer.duration = 0;
    const view = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" />);
    expect(view.container.textContent).not.toMatch(/NaN|Infinity/);
    const rates = Array.from(view.container.querySelectorAll('p')).filter((node) => /(?:cph|mBpm|ctph|Mdpm|rph|sph|dph|mph)$/.test(node.textContent ?? ''));
    expect(rates).toHaveLength(8);
    for (const rate of rates) expect(rate.textContent).toMatch(/^0 /);
    for (const box of view.container.querySelectorAll<HTMLDivElement>('div[style]')) {
      if (box.classList.contains('beveled-box')) expect(box.style.backgroundColor).toMatch(/^rgb\(/);
    }
  });

  it('guards floored-second rates while preserving fractional-hour rates', () => {
    fixture.timer.duration = 500;
    const view = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" />);
    expect(view.getByText('0 cph')).toBeTruthy();
    expect(view.getByText('0 mBpm')).toBeTruthy();
    expect(view.getByText('0 Mdpm')).toBeTruthy();
    expect(view.getByText(`${Math.round(fixture.data.chestTurns / (500 / 3600000))} ctph`)).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/NaN|Infinity/);
  });
});