import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAUNCH_SETTINGS } from '../src/preview/config';
import { resolveAppearance, type TimerVariant } from '../src/preview/appearance';
import { ShouldStartProvider, useShouldStart } from '../src/preview/timerContext';
import { useTimerRotation } from '../src/preview/useTimerRotation';

const fixture = vi.hoisted(() => ({
  data: { status: 'Disconnected', connected: false, maxChecks: 216, checkCount: 0, bonks: 0, chestTurns: 0, deaths: 0, rupees: 0, screens: 0, damage: 0, magic: 0 },
  timer: { duration: 3842000, startAt: 0, timeStarted: 0 },
  hasStarted: true,
}));

vi.mock('../src/preview/autotrack', () => ({ default: () => fixture.data }));
vi.mock('../src/preview/components/timer', () => ({ default: () => ({ ...fixture.timer, hasStarted: fixture.hasStarted }) }));

import PreviewApp from '../src/preview/App';

const STYLES: readonly TimerVariant[] = ['analog', 'lcd', 'flip'];
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

function RotationProbe({ styles = STYLES, running }: { styles?: readonly TimerVariant[]; running: boolean }) {
  return <output data-testid="face">{useTimerRotation(styles, running)}</output>;
}

function RunControls() {
  const { setTimerOn } = useShouldStart();
  return <>
    <button onClick={() => setTimerOn(true)}>run</button>
    <button onClick={() => setTimerOn(false)}>halt</button>
  </>;
}

function renderApp(timer: Record<string, unknown>) {
  const view = render(<ShouldStartProvider>
    <PreviewApp {...DEFAULT_LAUNCH_SETTINGS} boxes="3" appearance={resolveAppearance({ timer })} />
    <RunControls />
  </ShouldStartProvider>);
  return { view, heading: () => view.container.querySelector('h2')!, blat: () => view.container.querySelector<HTMLSpanElement>('.timer-blat') };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  fixture.data.connected = false;
  fixture.hasStarted = true;
});

describe('BeeBobble', () => {
  it('is absent by default', () => {
    const { view } = renderApp({});
    expect(view.container.querySelector('img[src*="beebobble"]')).toBeNull();
  });

  it('stays mounted before start, while running and while paused alongside BLAT', () => {
    fixture.hasStarted = false;
    const { view, blat } = renderApp({ beebobble: true, blat: true });
    const bee = view.container.querySelector<HTMLImageElement>('img[src*="beebobble"]')!;
    expect(bee.width).toBe(112);
    expect(bee.height).toBe(112);
    expect(bee.alt).toBe('');
    expect(bee.getAttribute('aria-hidden')).toBe('true');
    expect(blat()).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'FORCE TIMER START' }));
    advance(1000);
    expect(blat()).not.toBeNull();
    expect(view.container.querySelector('img[src*="beebobble"]')).toBe(bee);
    fireEvent.click(view.getByRole('button', { name: 'halt' }));
    expect(blat()).toBeNull();
    expect(view.container.querySelector('img[src*="beebobble"]')).toBe(bee);
  });

  it.each([undefined, null, false, 'true', 1, {}, [true]])('accepts only literal true, case %#', (beebobble) => {
    expect(resolveAppearance({ timer: { beebobble } }).timer.beebobble).toBeUndefined();
    expect(resolveAppearance({ timer: { beebobble: true } }).timer.beebobble).toBe(true);
  });

  it('uses an animated WebP asset configured to loop indefinitely', () => {
    const asset = readFileSync('src/assets/beebobble.webp');
    expect(asset.toString('ascii', 0, 4)).toBe('RIFF');
    expect(asset.toString('ascii', 8, 12)).toBe('WEBP');
    let frames = 0;
    let loops: number | undefined;
    for (let offset = 12; offset + 8 <= asset.length;) {
      const chunk = asset.toString('ascii', offset, offset + 4);
      const length = asset.readUInt32LE(offset + 4);
      if (chunk === 'ANIM') loops = asset.readUInt16LE(offset + 12);
      if (chunk === 'ANMF') frames += 1;
      offset += 8 + length + (length % 2);
    }
    expect(frames).toBeGreaterThan(1);
    expect(loops).toBe(0);
  });
});

describe('timer style rotation', () => {
  it('starts on a random selected style and never switches before the timer runs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const view = render(<RotationProbe running={false} />);
    expect(view.getByTestId('face').textContent).toBe('lcd');
    advance(200_000);
    expect(view.getByTestId('face').textContent).toBe('lcd');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('switches to a different selected style after 10 to 100 seconds of running', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const view = render(<RotationProbe running />);
    const face = () => view.getByTestId('face').textContent;
    expect(face()).toBe('analog');
    advance(9_999);
    expect(face()).toBe('analog');
    advance(1);
    expect(face()).toBe('lcd');
    advance(10_000);
    expect(face()).toBe('analog');
    view.unmount();

    random.mockReturnValue(0.9999);
    const slow = render(<RotationProbe running />);
    expect(slow.getByTestId('face').textContent).toBe('flip');
    advance(99_990);
    expect(slow.getByTestId('face').textContent).toBe('flip');
    advance(1);
    expect(slow.getByTestId('face').textContent).toBe('lcd');
  });

  it('holds the style while paused and draws a fresh delay on resume', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const view = render(<RotationProbe running />);
    advance(9_000);
    view.rerender(<RotationProbe running={false} />);
    advance(200_000);
    expect(view.getByTestId('face').textContent).toBe('analog');
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(<RotationProbe running />);
    advance(9_999);
    expect(view.getByTestId('face').textContent).toBe('analog');
    advance(1);
    expect(view.getByTestId('face').textContent).toBe('lcd');
  });

  it('never schedules switches for a single style', () => {
    const view = render(<RotationProbe styles={['roman']} running />);
    advance(200_000);
    expect(view.getByTestId('face').textContent).toBe('roman');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rotates the tracker face only while the timer runs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { view, heading } = renderApp({ variant: 'rotation', rotation: ['analog', 'roman'] });
    expect(view.getByRole('img', { name: '01:04:03' })).toBeTruthy();
    advance(200_000);
    expect(view.getByRole('img', { name: '01:04:03' })).toBeTruthy();
    fireEvent.click(view.getByText('run'));
    advance(10_000);
    expect(heading().textContent).toBe('I:IV:III');
    expect(heading().style.whiteSpace).toBe('nowrap');
    expect(heading().querySelector('.timer-face-roman')).not.toBeNull();
    advance(10_000);
    expect(heading().querySelector('.timer-face-roman')).toBeNull();
    expect(heading().style.whiteSpace).toBe('');
    advance(10_000);
    expect(heading().querySelector('.timer-face-roman')).not.toBeNull();
    fireEvent.click(view.getByText('halt'));
    advance(200_000);
    expect(heading().textContent).toBe('I:IV:III');
  });
});

describe('BLAT overlay', () => {
  it('jumps around the running timer at half the timer size in Impact', () => {
    let next = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => (next = (next + 0.37) % 1));
    const { view, heading, blat } = renderApp({ variant: 'lcd', blat: true });
    expect(blat()).toBeNull();
    fireEvent.click(view.getByText('run'));
    const overlay = blat()!;
    expect(overlay.textContent).toBe('BLAT!!!');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.style.fontSize).toBe('18px');
    expect(overlay.style.color).toBe('rgb(59, 130, 246)');
    expect(overlay.parentElement).toBe(heading().parentElement);
    expect(heading().parentElement!.style.position).toBe('relative');
    expect(heading().parentElement!.style.overflow).toBe('clip');
    expect(heading().textContent).not.toContain('BLAT');
    const before = overlay.getAttribute('style');
    advance(300);
    expect(blat()!.getAttribute('style')).not.toBe(before);
    const angle = Number(blat()!.style.transform.match(/^translate\(-50%, -50%\) rotate\((-?[\d.]+)deg\)$/)![1]);
    expect(Math.abs(angle)).toBeLessThanOrEqual(80);
    expect(blat()!.getAttribute('style')).toMatch(/left: calc\(28\.8px \+ [\d.]+ \* \(100% - 57\.6px\)\)/);
    expect(blat()!.getAttribute('style')).toMatch(/top: calc\(28\.8px \+ [\d.]+ \* \(100% - 57\.6px\)\)/);
    fireEvent.click(view.getByText('halt'));
    expect(blat()).toBeNull();
    const css = readFileSync('src/preview/timerFaces.css', 'utf8');
    expect(css).toMatch(/\.timer-blat\s*{[^}]*font-family:\s*Impact,/);
    expect(css).toMatch(/\.timer-blat\s*{[^}]*-webkit-text-stroke:\s*2px #000;[^}]*paint-order:\s*stroke fill;/);
  });

  it('keeps the default wrapper markup when BLAT is off', () => {
    const { view, heading, blat } = renderApp({});
    fireEvent.click(view.getByText('run'));
    expect(blat()).toBeNull();
    expect(heading().parentElement!.hasAttribute('style')).toBe(false);
  });
});

describe('force timer start', () => {
  it.each([
    [false, false, true],
    [false, true, false],
    [true, false, false],
    [true, true, false],
  ])('with started=%s and connected=%s shows the button: %s', (started, connected, visible) => {
    fixture.hasStarted = started;
    fixture.data.connected = connected;
    const { view } = renderApp({});
    expect(view.queryByRole('button', { name: 'FORCE TIMER START' }) !== null).toBe(visible);
  });
});
