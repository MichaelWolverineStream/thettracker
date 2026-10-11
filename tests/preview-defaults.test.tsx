import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import LaunchPage from '../src/landing/LaunchPage';
import { parsePreviewSettings } from '../src/preview/config';
import { METRICS } from '../src/preview/appearance';
import { MAX_DEFAULTS_LENGTH, PREVIEW_DEFAULTS_KEY, factoryPreviewDefaults, loadPreviewDefaults, savePreviewDefaults } from '../src/landing/previewDefaults';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('preview editor draft and save lifecycle', () => {
  const preview = () => within(screen.getByRole('region', { name: 'v0.1.0-preview' }));

  it('launches the current unsaved draft, retaining colors on disabled metrics without writing', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const sockets = vi.spyOn(window, 'WebSocket');
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Timer color'), { target: { value: '#123456' } });
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'space-mono' } });
    fireEvent.click(preview().getByRole('button', { name: 'Bonks colors', exact: true }));
    fireEvent.change(preview().getByLabelText('Bonks stop 1'), { target: { value: '#123abc' } });
    fireEvent.click(preview().getByRole('checkbox', { name: 'Bonks (milliBonks per minute)', exact: true }));
    expect(preview().getByRole('status').textContent).toBe('Unsaved');
    fireEvent.click(preview().getByRole('button', { name: 'Launch', exact: true }));
    const settings = parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/nested/').search);
    expect(settings.bonks).toBe(false);
    expect(settings.appearance.timer).toEqual({ color: '#123456', font: 'space-mono' });
    expect(settings.appearance.palettes.bonks[0]).toBe('#123ABC');
    expect(writes).not.toHaveBeenCalled();
    expect(sockets).not.toHaveBeenCalled();
    const legacy = within(screen.getByRole('region', { name: 'v0.0.43-legacy' }));
    expect((legacy.getByRole('checkbox', { name: 'Bonks (milliBonks per minute)', exact: true }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(legacy.getByRole('button', { name: 'Launch', exact: true }));
    expect(open.mock.calls[1][0]).not.toContain('appearance');
  });

  it('loads only at mount, saves explicitly, and resets only the current draft until saved', () => {
    const initial = factoryPreviewDefaults();
    initial.widgets.magic = false;
    initial.appearance.timer.color = '#445566';
    savePreviewDefaults(initial);
    const reads = vi.spyOn(Storage.prototype, 'getItem');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<LaunchPage />);
    expect(reads).toHaveBeenCalledTimes(1);
    expect((preview().getByLabelText('Timer color') as HTMLInputElement).value).toBe('#445566');
    fireEvent.click(preview().getByRole('button', { name: 'Reset', exact: true }));
    expect((preview().getByLabelText('Timer color') as HTMLInputElement).value).toBe('#3b82f6');
    expect(writes).not.toHaveBeenCalled();
    view.unmount();
    render(<LaunchPage />);
    expect((preview().getByLabelText('Timer color') as HTMLInputElement).value).toBe('#445566');
    fireEvent.click(preview().getByRole('button', { name: 'Reset', exact: true }));
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(preview().getByRole('status').textContent).toBe('Saved');
    expect(writes).toHaveBeenCalledTimes(1);
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
  });

  it('resets one palette without changing another and permits launch after save failure', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    fireEvent.click(preview().getByRole('button', { name: 'Bonks colors', exact: true }));
    fireEvent.click(preview().getByRole('button', { name: 'Checks colors', exact: true }));
    fireEvent.change(preview().getByLabelText('Bonks stop 1'), { target: { value: '#123456' } });
    fireEvent.change(preview().getByLabelText('Checks stop 1'), { target: { value: '#654321' } });
    fireEvent.click(preview().getByRole('button', { name: 'Reset Bonks colors' }));
    expect((preview().getByLabelText('Bonks stop 1') as HTMLInputElement).value).toBe('#ffbe0b');
    expect((preview().getByLabelText('Checks stop 1') as HTMLInputElement).value).toBe('#654321');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(preview().getByRole('status').textContent).toBe('Save failed');
    fireEvent.click(preview().getByRole('button', { name: 'Launch', exact: true }));
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('landing-only preview defaults', () => {
  it('loads all-enabled factory launcher defaults without writing or changing tracker defaults', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
    expect(Object.values(loadPreviewDefaults().widgets).every(Boolean)).toBe(true);
    expect(parsePreviewSettings('').checkCount).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });

  it('saves the full validated selection, excluding layout and runtime state', () => {
    const settings = factoryPreviewDefaults();
    settings.widgets.bonks = false;
    settings.appearance.timer = { color: '#123456', font: 'space-mono' };
    settings.appearance.palettes.chestTurns = ['#ABCDEF', '#123ABC', '#FEDCBA'];
    expect(savePreviewDefaults(settings)).toBe(true);
    expect(loadPreviewDefaults()).toEqual(settings);
    const stored = JSON.parse(window.localStorage.getItem(PREVIEW_DEFAULTS_KEY)!);
    expect(Object.keys(stored)).toEqual(['v', 'widgets', 'appearance']);
    expect(stored).not.toHaveProperty('boxes');
    expect(stored).not.toHaveProperty('timerOn');
  });

  it('retains valid partial settings and defaults only invalid sibling fields', () => {
    window.localStorage.setItem(PREVIEW_DEFAULTS_KEY, JSON.stringify({ v: 1, widgets: { bonks: false, damage: 'false', unknown: true }, appearance: { timer: { color: '#abcdef', font: 'untrusted' }, palettes: { chestTurns: ['#000000', '#112233', '#FFFFFF'], magic: [] } } }));
    const loaded = loadPreviewDefaults();
    expect(loaded.widgets.bonks).toBe(false);
    expect(loaded.widgets.damage).toBe(true);
    expect(loaded.widgets).not.toHaveProperty('unknown');
    expect(loaded.appearance.timer).toEqual({ color: '#ABCDEF', font: 'default' });
    expect(loaded.appearance.palettes.chestTurns).toEqual(['#000000', '#112233', '#FFFFFF']);
    expect(loaded.appearance.palettes.magic).toEqual(METRICS.magic.colors);
  });

  it.each(['broken', 'null', '[]', '{"v":2}', JSON.stringify({ v: 1, padding: 'x'.repeat(MAX_DEFAULTS_LENGTH) })])('ignores corrupt or unsupported storage case %# without erasing it', (raw) => {
    window.localStorage.setItem(PREVIEW_DEFAULTS_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const erases = vi.spyOn(Storage.prototype, 'removeItem');
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
    expect(writes).not.toHaveBeenCalled();
    expect(erases).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PREVIEW_DEFAULTS_KEY)).toBe(raw);
  });

  it('handles a denied storage getter', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
    expect(savePreviewDefaults(factoryPreviewDefaults())).toBe(false);
    expect(parsePreviewSettings('').appearance.timer.color).toBe('#3B82F6');
  });

  it('handles denied reads and quota-exceeded writes', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
    expect(savePreviewDefaults(factoryPreviewDefaults())).toBe(false);
  });
});