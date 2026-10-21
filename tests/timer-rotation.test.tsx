import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAUNCH_SETTINGS } from '../src/preview/config';
import { resolveAppearance, type TimerVariant } from '../src/preview/appearance';
import { ShouldStartProvider } from '../src/preview/timerContext';
import { useShouldStart } from '../src/preview/useShouldStart';
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
const advance = (ms: number) => { act(() => { vi.advanceTimersByTime(ms); }); };

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

const blatAngle = (overlay: HTMLSpanElement) => Number(/rotate\((-?[\d.]+)deg\)/.exec(overlay.style.transform)![1]);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  fixture.hasStarted = true;
});

describe('BeeBobble', () => {
  it('is absent when off and stays mounted before start, while running and while paused alongside BLAT', () => {
    fixture.hasStarted = false;
    const off = renderApp({});
    expect(off.view.container.querySelector('img[src*="beebobble"]')).toBeNull();
    off.view.unmount();

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
});

describe('timer style rotation', () => {
  it('starts on a random selected style and never switches before the timer runs or with a single style', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const view = render(<RotationProbe running={false} />);
    expect(view.getByTestId('face').textContent).toBe('lcd');
    advance(200_000);
    expect(view.getByTestId('face').textContent).toBe('lcd');
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();

    const single = render(<RotationProbe styles={['roman']} running />);
    advance(200_000);
    expect(single.getByTestId('face').textContent).toBe('roman');
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
  it('leaves the timer untouched when off and jumps around the running timer at half size when on', () => {
    const off = renderApp({});
    fireEvent.click(off.view.getByText('run'));
    expect(off.blat()).toBeNull();
    expect(off.heading().parentElement!.hasAttribute('style')).toBe(false);
    off.view.unmount();

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
    expect(Math.abs(blatAngle(overlay))).toBeLessThanOrEqual(80);

    const before = { left: overlay.style.left, top: overlay.style.top, transform: overlay.style.transform };
    advance(299);
    expect({ left: blat()!.style.left, top: blat()!.style.top, transform: blat()!.style.transform }).toEqual(before);
    advance(1);
    expect(blat()!.style.left).not.toBe(before.left);
    expect(blat()!.style.top).not.toBe(before.top);
    expect(Math.abs(blatAngle(blat()!))).toBeLessThanOrEqual(80);

    fireEvent.click(view.getByText('halt'));
    expect(blat()).toBeNull();
  });
});
