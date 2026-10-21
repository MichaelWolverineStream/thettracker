import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAUNCH_SETTINGS } from '../src/preview/config';
import { resolveAppearance } from '../src/preview/appearance';

const fixture = vi.hoisted(() => ({
  data: { status: 'Connected', maxChecks: 216, checkCount: 55, bonks: 2, chestTurns: 11, deaths: 1, rupees: 500, screens: 120, damage: 127, magic: 240 },
  timer: { duration: 3600000, startAt: 0, timeStarted: 0 },
  previewHasStarted: true,
}));

vi.mock('../src/legacy/autotrack', () => ({ default: () => fixture.data }));
vi.mock('../src/preview/autotrack', () => ({ default: () => fixture.data }));
vi.mock('../src/legacy/components/timer', () => ({ default: () => fixture.timer }));
vi.mock('../src/preview/components/timer', () => ({ default: () => ({ ...fixture.timer, hasStarted: fixture.previewHasStarted }) }));

import LegacyApp from '../src/legacy/App';
import PreviewApp from '../src/preview/App';

afterEach(() => {
  cleanup();
  fixture.timer.duration = 3600000;
  fixture.previewHasStarted = true;
});

describe('finite-time tracker parity', () => {
  it('preserves metric markup, counts, formulas and palettes with maxChecks 216', () => {
    const legacy = render(<LegacyApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" />);
    const expected = legacy.container.innerHTML;
    legacy.unmount();
    const preview = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" />);
    expect(preview.container.innerHTML).toBe(expected);
  });

  it('preserves every formula at 30000 ms', () => {
    fixture.timer.duration = 30000;
    const legacy = render(<LegacyApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" />);
    const expected = legacy.container.innerHTML;
    const expectedMetrics = legacy.container.querySelector('.inline-grid')!.outerHTML;
    legacy.unmount();
    const preview = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" />);
    expect(preview.container.querySelector('.inline-grid')!.outerHTML).toBe(expectedMetrics);
    expect(preview.container.innerHTML).toBe(expected);
  });

  it.each([
    { duration: 0, hasStarted: false, preview: '00:00:00', legacy: '00:00:00' },
    { duration: 0, hasStarted: true, preview: '00:00:01', legacy: '00:00:00' },
    { duration: 1750, hasStarted: true, preview: '00:00:02', legacy: '00:00:03' },
  ])('applies preview-only 1000 ms timer compensation at $duration ms with started=$hasStarted', ({ duration, hasStarted, preview, legacy }) => {
    fixture.timer.duration = duration;
    fixture.previewHasStarted = hasStarted;
    const legacyView = render(<LegacyApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" />);
    expect(legacyView.container.querySelector('h2')!.textContent).toBe(legacy);
    legacyView.unmount();
    const previewView = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" />);
    expect(previewView.container.querySelector('h2')!.textContent).toBe(preview);
    if (hasStarted) expect(previewView.getByText('DE-FLUFF')).toBeTruthy();
    else expect(previewView.queryByText('DE-FLUFF')).toBeNull();
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

  it('applies custom timer styles and palette colors without changing metric typography', () => {
    const appearance = resolveAppearance(undefined);
    appearance.timer = { color: '#123456', font: 'ibm-plex-mono' };
    appearance.palettes.checkCount = ['#112233', '#112233', '#112233', '#112233', '#112233'];
    const view = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" appearance={appearance} />);
    const timer = view.container.querySelector('h2')!;
    expect(timer.style.color).toBe('rgb(18, 52, 86)');
    expect(timer.style.fontFamily).toContain('Tracker IBM Plex Mono');
    const checks = view.getByRole('button', { name: /^Checks/ });
    expect(checks.querySelector<HTMLDivElement>('.beveled-box')!.style.backgroundColor).toBe('rgb(17, 34, 51)');
    expect(checks.querySelectorAll('p')[1].style.color).toBe('rgb(17, 34, 51)');
    expect(checks.querySelector('span')!.style.fontFamily).toBe('');
  });

  it('keeps custom Checks colors through the 400/401 threshold boundary and sticky transition', () => {
    const appearance = resolveAppearance(undefined);
    appearance.palettes.checkCount = ['#000000', '#444444', '#888888', '#CCCCCC', '#FFFFFF'];
    fixture.data.checkCount = 100;
    fixture.data.maxChecks = 400;
    const view = render(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" appearance={appearance} />);
    const color = () => view.getByRole('button', { name: /^Checks/ }).querySelector<HTMLDivElement>('.beveled-box')!.style.backgroundColor;
    expect(color()).toBe('rgb(136, 136, 136)');
    fixture.data.maxChecks = 401;
    view.rerender(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" appearance={appearance} />);
    expect(color()).toBe('rgb(0, 0, 0)');
    fixture.data.maxChecks = 400;
    view.rerender(<PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="4" appearance={appearance} />);
    expect(color()).toBe('rgb(0, 0, 0)');
    fixture.data.checkCount = 55;
  });
});