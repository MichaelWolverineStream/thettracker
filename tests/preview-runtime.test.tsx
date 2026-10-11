import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useTimer from '../src/preview/components/timer';
import { ShouldStartProvider, useShouldStart } from '../src/preview/timerContext';
import Box from '../src/preview/components/statbox';
import useAutoTrackWebSocket from '../src/preview/autotrack';
import { FakeSniSocket, memoryFrame } from './helpers/sni';
import { WIDGETS } from '../src/preview/config';
import { METRICS, createSpeedMap, hexToRgb, resolveAppearance } from '../src/preview/appearance';

function TimerProbe() {
  const { setShouldStart, setTimerOn, timerOn } = useShouldStart();
  const timer = useTimer({ duration: 0, startAt: 0, timeStarted: 0 });
  return (
    <>
      <output data-testid="duration">{timer.duration}</output>
      <output data-testid="running">{String(timerOn)}</output>
      <button onClick={() => setShouldStart(true)}>auto start</button>
      <button onClick={() => setShouldStart(false)}>auto stop</button>
      <button onClick={() => setTimerOn(false)}>pause</button>
      <button onClick={() => setTimerOn(true)}>resume</button>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('preview timer accounting', () => {
  it('banks partial seconds on automatic stops and resumes without counting paused wall time', () => {
    const view = render(<ShouldStartProvider><TimerProbe /></ShouldStartProvider>);
    fireEvent.click(view.getByText('auto start'));
    act(() => vi.advanceTimersByTime(2450));
    fireEvent.click(view.getByText('auto stop'));
    expect(view.getByTestId('duration').textContent).toBe('2450');
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(view.getByText('auto start'));
    act(() => vi.advanceTimersByTime(1250));
    fireEvent.click(view.getByText('auto stop'));
    expect(view.getByTestId('duration').textContent).toBe('3700');
    fireEvent.click(view.getByText('auto stop'));
    expect(view.getByTestId('duration').textContent).toBe('3700');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains manual pause precedence, mixes stops and clears intervals on unmount', () => {
    const view = render(<ShouldStartProvider><TimerProbe /></ShouldStartProvider>);
    fireEvent.click(view.getByText('auto start'));
    act(() => vi.advanceTimersByTime(1750));
    fireEvent.click(view.getByText('pause'));
    expect(view.getByTestId('duration').textContent).toBe('1750');
    fireEvent.click(view.getByText('auto start'));
    expect(view.getByTestId('running').textContent).toBe('false');
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(view.getByText('resume'));
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.click(view.getByText('auto stop'));
    expect(view.getByTestId('duration').textContent).toBe('3250');
    fireEvent.click(view.getByText('resume'));
    expect(view.getByTestId('running').textContent).toBe('true');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('preview color safety', () => {
  it.each(WIDGETS)('keeps $name custom stops, midpoint interpolation and endpoint clamping', ({ name }) => {
    const appearance = resolveAppearance(undefined);
    appearance.palettes[name] = METRICS[name].colors.map((_, index) => ['#102030', '#304050', '#506070', '#708090', '#90A0B0'][index]);
    const { buckets, colors } = createSpeedMap(appearance)[METRICS[name].unit];
    const view = render(<Box title={name} count={0} speed={0} unit="rate" buckets={buckets} colors={colors} />);
    const color = () => view.container.querySelector<HTMLDivElement>('.beveled-box')!.style.backgroundColor;
    for (const [index, speed] of buckets.entries()) {
      view.rerender(<Box title={name} count={0} speed={speed} unit="rate" buckets={buckets} colors={colors} />);
      expect(color()).toBe(`rgb(${hexToRgb(appearance.palettes[name][index]).join(', ')})`);
      expect(view.container.querySelectorAll('p')[1].style.color).toBe(color());
    }
    view.rerender(<Box title={name} count={0} speed={(buckets[0] + buckets[1]) / 2} unit="rate" buckets={buckets} colors={colors} />);
    expect(color()).toBe('rgb(32, 48, 64)');
    expect(view.container.querySelectorAll('p')[1].style.color).toBe(color());
    for (const speed of [Number.NaN, Number.NEGATIVE_INFINITY, buckets[0] - 1]) {
      view.rerender(<Box title={name} count={0} speed={speed} unit="rate" buckets={buckets} colors={colors} />);
      expect(color()).toBe('rgb(16, 32, 48)');
    }
    view.rerender(<Box title={name} count={0} speed={Number.POSITIVE_INFINITY} unit="rate" buckets={buckets} colors={colors} />);
    expect(color()).toBe(`rgb(${colors[colors.length - 1].join(', ')})`);
  });

  it.each([
    [Number.NaN, 'rgb(58, 134, 255)'],
    [Number.NEGATIVE_INFINITY, 'rgb(58, 134, 255)'],
    [Number.POSITIVE_INFINITY, 'rgb(255, 190, 11)'],
    [-10, 'rgb(58, 134, 255)'],
    [0, 'rgb(58, 134, 255)'],
    [10, 'rgb(255, 190, 11)'],
    [100, 'rgb(255, 190, 11)'],
  ])('renders a valid color for speed %s', (speed, expected) => {
    const view = render(<Box title="Checks" count={0} speed={speed as number} unit="cph" buckets={[0, 10]} colors={[[58, 134, 255], [255, 190, 11]]} />);
    expect(view.container.querySelector<HTMLDivElement>('.beveled-box')!.style.backgroundColor).toBe(expected);
  });

  it('retains midpoint interpolation and guards zero-width intervals', () => {
    const view = render(<Box title="Checks" count={0} speed={5} unit="cph" buckets={[0, 10]} colors={[[0, 20, 40], [100, 120, 140]]} />);
    expect(view.container.querySelector<HTMLDivElement>('.beveled-box')!.style.backgroundColor).toBe('rgb(50, 70, 90)');
    view.rerender(<Box title="Checks" count={0} speed={0} unit="cph" buckets={[0, 0]} colors={[[0, 20, 40], [100, 120, 140]]} />);
    expect(view.container.querySelector<HTMLDivElement>('.beveled-box')!.style.backgroundColor).toBe('rgb(0, 20, 40)');
  });
});

function SniProbe() {
  const { shouldStart, setTimerOn } = useShouldStart();
  const data = useAutoTrackWebSocket({
    status: 'Disconnected', host: 'ws://localhost', port: 23074,
    maxChecks: 216, checkCount: 0, bonks: 0, chestTurns: 0,
    deaths: 0, rupees: 0, screens: 0, damage: 0, magic: 0,
  });
  const timer = useTimer({ duration: 0, startAt: 0, timeStarted: 0 });
  return <>
    <output data-testid="stats">{JSON.stringify(data)}</output>
    <output data-testid="status">{data.status}</output>
    <output data-testid="started">{String(shouldStart)}</output>
    <output data-testid="elapsed">{timer.duration}</output>
    <button onClick={() => setTimerOn(false)}>manual pause</button>
  </>;
}

const advance = (duration: number) => act(() => vi.advanceTimersByTime(duration));
const reply = (socket: FakeSniSocket, payload: string | ArrayBuffer) => act(() => socket.message(payload));
const mode = (socket: FakeSniSocket, value: number) => reply(socket, new Uint8Array([value]).buffer);

function renderSni() {
  return render(<ShouldStartProvider><SniProbe /></ShouldStartProvider>);
}

function attach(socket: FakeSniSocket) {
  act(() => socket.open());
  reply(socket, JSON.stringify({ Results: ['Fixture', 'Other'] }));
  expect(socket.lastCommand).toEqual({ Opcode: 'Attach', Space: 'SNES', Operands: ['Fixture'] });
  advance(500);
}

describe('preview SNI ownership and bounded continuous recovery', () => {
  beforeEach(() => {
    FakeSniSocket.instances = [];
    FakeSniSocket.failConstruction = false;
    vi.stubGlobal('WebSocket', FakeSniSocket);
  });

  it('keeps retrying absent SNI indefinitely without faster attempts and connects when it appears', () => {
    const view = renderSni();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const socket = FakeSniSocket.instances.at(-1)!;
      act(() => socket.fail());
      expect(socket.readyState).toBe(FakeSniSocket.CLOSED);
      advance(4999);
      expect(FakeSniSocket.instances).toHaveLength(attempt + 1);
      advance(1);
      expect(FakeSniSocket.instances).toHaveLength(attempt + 2);
    }
    const socket = FakeSniSocket.instances.at(-1)!;
    attach(socket);
    mode(socket, 7);
    reply(socket, memoryFrame());
    expect(view.getByTestId('status').textContent).toBe('Connected to Fixture');
    expect(view.getByTestId('started').textContent).toBe('true');
    expect(FakeSniSocket.instances.filter((instance) => instance.readyState !== FakeSniSocket.CLOSED)).toHaveLength(1);
  });

  it('deduplicates error+close races and ignores retired-socket callbacks', () => {
    renderSni();
    const retired = FakeSniSocket.instances[0];
    const lateClose = retired.onclose!;
    const lateOpen = retired.onopen!;
    act(() => {
      retired.fail();
      lateClose(new CloseEvent('close'));
    });
    expect(vi.getTimerCount()).toBe(1);
    advance(5000);
    const current = FakeSniSocket.instances[1];
    act(() => {
      lateOpen(new Event('open'));
      lateClose(new CloseEvent('close'));
    });
    expect(retired.sent).toHaveLength(0);
    expect(current.closeCount).toBe(0);
    expect(FakeSniSocket.instances).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('retries device discovery on an open bridge without connection churn or memory polling', () => {
    const view = renderSni();
    const socket = FakeSniSocket.instances[0];
    act(() => socket.open());
    for (let attempt = 0; attempt < 12; attempt += 1) {
      reply(socket, JSON.stringify({ Results: [] }));
      expect(view.getByTestId('status').textContent).toBe('No devices found');
      const count = socket.sent.length;
      advance(4999);
      expect(socket.sent).toHaveLength(count);
      advance(1);
      expect(socket.sent).toHaveLength(count + 1);
      expect(socket.lastCommand?.Opcode).toBe('DeviceList');
    }
    expect(FakeSniSocket.instances).toHaveLength(1);
    reply(socket, JSON.stringify({ Results: ['Later'] }));
    expect(socket.lastCommand?.Opcode).toBe('Attach');
    advance(500);
    expect(socket.lastCommand?.Operands).toEqual(['f50010', '1']);
    expect(view.getByTestId('status').textContent).toBe('Connected to Later');
  });

  it.each(['opening', 'devices', 'mode', 'sram'])('retires a stalled %s session then waits five seconds before retrying', (phase) => {
    const view = renderSni();
    const socket = FakeSniSocket.instances[0];
    if (phase !== 'opening') act(() => socket.open());
    if (phase === 'mode' || phase === 'sram') {
      reply(socket, JSON.stringify({ Results: ['Fixture'] }));
      advance(500);
    }
    if (phase === 'sram') mode(socket, 7);
    advance(4999);
    expect(socket.closeCount).toBe(0);
    advance(1);
    expect(socket.closeCount).toBe(1);
    expect(view.getByTestId('status').textContent).toMatch(/timed out/);
    advance(4999);
    expect(FakeSniSocket.instances).toHaveLength(1);
    advance(1);
    expect(FakeSniSocket.instances).toHaveLength(2);
  });

  it('accepts a reply just before the deadline and does not falsely reconnect', () => {
    renderSni();
    const socket = FakeSniSocket.instances[0];
    act(() => socket.open());
    advance(4999);
    reply(socket, JSON.stringify({ Results: ['Fixture'] }));
    advance(500);
    mode(socket, 0);
    expect(socket.closeCount).toBe(0);
    expect(FakeSniSocket.instances).toHaveLength(1);
  });

  it('serializes slow SRAM reads, retains byte decoding and does not pause on transport failure', () => {
    const view = renderSni();
    const socket = FakeSniSocket.instances[0];
    attach(socket);
    mode(socket, 7);
    expect(socket.lastCommand?.Operands).toEqual(['f5f000', '4ff']);
    const commands = socket.sent.length;
    advance(1500);
    expect(socket.sent).toHaveLength(commands);
    reply(socket, memoryFrame({ maxChecks: 500, checkCount: 300 }));
    expect(JSON.parse(view.getByTestId('stats').textContent!).checkCount).toBe(0);
    advance(0);
    mode(socket, 9);
    reply(socket, memoryFrame({ maxChecks: 500, checkCount: 300, bonks: 3, chestTurns: 4, deaths: 2, rupees: 513, screens: 1026, damage: 257, magic: 385 }));
    expect(JSON.parse(view.getByTestId('stats').textContent!)).toMatchObject({
      maxChecks: 500, checkCount: 300, prevCheckCount: 0, bonks: 3, chestTurns: 4,
      deaths: 2, rupees: 513, screens: 1026, damage: 257, magic: 385,
    });
    const modeTimes = socket.sent.filter(({ command }) => command.Operands?.[0] === 'f50010').map(({ time }) => time);
    expect(modeTimes[1] - modeTimes[0]).toBeGreaterThanOrEqual(500);
    act(() => socket.fail());
    const elapsed = Number(view.getByTestId('elapsed').textContent);
    advance(1000);
    expect(Number(view.getByTestId('elapsed').textContent)).toBeGreaterThan(elapsed);
    expect(view.getByTestId('started').textContent).toBe('true');
  });

  it('runs healthy polls without overlapping requests or watchdog reconnects', () => {
    renderSni();
    const socket = FakeSniSocket.instances[0];
    attach(socket);
    for (let poll = 0; poll < 120; poll += 1) {
      expect(socket.lastCommand?.Operands?.[0]).toBe('f50010');
      mode(socket, 7);
      expect(socket.lastCommand?.Operands?.[0]).toBe('f5f000');
      reply(socket, memoryFrame());
      const count = socket.sent.length;
      advance(499);
      expect(socket.sent).toHaveLength(count);
      advance(1);
      expect(socket.sent).toHaveLength(count + 1);
    }
    expect(FakeSniSocket.instances).toHaveLength(1);
    expect(socket.closeCount).toBe(0);
  });

  it.each(['devices', 'mode', 'sram'])('recovers from malformed %s replies without flooding', (phase) => {
    renderSni();
    const socket = FakeSniSocket.instances[0];
    act(() => socket.open());
    if (phase !== 'devices') {
      reply(socket, JSON.stringify({ Results: ['Fixture'] }));
      advance(500);
    }
    if (phase === 'sram') mode(socket, 7);
    reply(socket, phase === 'devices' ? '{bad json' : new Uint8Array([1, 2]).buffer);
    expect(socket.closeCount).toBe(1);
    expect(vi.getTimerCount()).toBe(phase === 'sram' ? 2 : 1);
    advance(5000);
    expect(FakeSniSocket.instances).toHaveLength(2);
  });

  it.each(['opening', 'devices', 'waiting-device', 'mode', 'sram', 'retry'])('unmounts during %s with no later connections or updates', (phase) => {
    const view = renderSni();
    const socket = FakeSniSocket.instances[0];
    if (phase !== 'opening' && phase !== 'retry') act(() => socket.open());
    if (phase === 'waiting-device') reply(socket, JSON.stringify({ Results: [] }));
    if (phase === 'mode' || phase === 'sram') {
      reply(socket, JSON.stringify({ Results: ['Fixture'] }));
      advance(500);
    }
    if (phase === 'sram') mode(socket, 7);
    if (phase === 'retry') act(() => socket.fail());
    const lateMessage = socket.onmessage;
    view.unmount();
    expect(socket.readyState).toBe(FakeSniSocket.CLOSED);
    expect(vi.getTimerCount()).toBe(0);
    act(() => lateMessage?.(new MessageEvent('message', { data: JSON.stringify({ Results: ['Ghost'] }) })));
    advance(60000);
    expect(FakeSniSocket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('survives setup-cleanup-setup with one owned session', () => {
    const view = render(<React.StrictMode><ShouldStartProvider><SniProbe /></ShouldStartProvider></React.StrictMode>);
    expect(FakeSniSocket.instances).toHaveLength(2);
    expect(FakeSniSocket.instances[0].readyState).toBe(FakeSniSocket.CLOSED);
    expect(FakeSniSocket.instances[1].readyState).toBe(FakeSniSocket.CONNECTING);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('continues bounded recovery when the WebSocket constructor throws', () => {
    FakeSniSocket.failConstruction = true;
    const view = renderSni();
    expect(view.getByTestId('status').textContent).toBe('Error');
    expect(vi.getTimerCount()).toBe(1);
    advance(20000);
    expect(FakeSniSocket.instances).toHaveLength(0);
    FakeSniSocket.failConstruction = false;
    advance(5000);
    expect(FakeSniSocket.instances).toHaveLength(1);
  });
});