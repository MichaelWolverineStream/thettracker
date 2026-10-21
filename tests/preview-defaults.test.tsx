import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LaunchPage from '../src/landing/LaunchPage';
import { parsePreviewSettings } from '../src/preview/config';
import { METRICS } from '../src/preview/appearance';
import * as fontAssets from '../src/preview/customFonts';
import { PREVIEW_DEFAULTS_KEY, factoryPreviewDefaults, loadPreviewDefaults, savePreviewDefaults } from '../src/landing/previewDefaults';

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
afterEach(() => {
  cleanup();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts); else Reflect.deleteProperty(document, 'fonts');
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('preview editor draft and save lifecycle', () => {
  const preview = () => within(screen.getByRole('region', { name: 'v0.2.0-preview' }));

  it('saves and resets appearance options without false unsaved changes', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    render(<LaunchPage />);
    const style = () => preview().getByLabelText<HTMLSelectElement>('Timer style');
    const language = () => preview().getByLabelText<HTMLSelectElement>('Words language');
    const blat = () => preview().getByRole<HTMLInputElement>('switch', { name: 'BLAT' });
    const bee = () => preview().getByRole<HTMLInputElement>('checkbox', { name: 'BeeBobble' });
    const status = () => preview().getByRole('status').textContent;
    const overlay = () => preview().getByLabelText('Timer preview').parentElement!.querySelector<HTMLSpanElement>('.timer-blat');
    const beeImage = () => document.querySelector('img[src*="beebobble"]');
    const options = { color: '#3B82F6', font: 'default', variant: 'words', language: 'sv', blat: true, beebobble: true };
    fireEvent.change(style(), { target: { value: 'words' } });
    expect(status()).toBe('Unsaved');
    fireEvent.change(language(), { target: { value: 'fr' } });
    fireEvent.change(language(), { target: { value: 'en' } });
    fireEvent.click(blat());
    fireEvent.click(bee());
    fireEvent.click(blat());
    fireEvent.click(bee());
    fireEvent.change(style(), { target: { value: 'digital' } });
    expect(status()).toBe('');
    fireEvent.change(style(), { target: { value: 'words' } });
    fireEvent.change(language(), { target: { value: 'sv' } });
    fireEvent.click(blat());
    expect(overlay()!.textContent).toBe('BLAT!!!');
    expect(overlay()!.style.fontSize).toBe('15px');
    expect(bee().checked).toBe(false);
    expect(beeImage()).toBeNull();
    fireEvent.click(bee());
    expect(beeImage()!.getAttribute('width')).toBe('112');
    expect(blat().checked).toBe(true);
    expect(status()).toBe('Unsaved');
    fireEvent.click(preview().getByRole('button', { name: 'Launch' }));
    expect(parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/').search).appearance.timer).toEqual(options);
    expect(writes).not.toHaveBeenCalled();
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(status()).toBe('Saved');
    expect(loadPreviewDefaults().appearance.timer).toEqual(options);
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'bungee' } });
    expect(status()).toBe('Unsaved');
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'default' } });
    expect(status()).toBe('');
    cleanup();
    render(<LaunchPage />);
    expect([style().value, language().value, blat().checked, bee().checked]).toEqual(['words', 'sv', true, true]);
    fireEvent.click(preview().getByRole('button', { name: 'Reset' }));
    expect(style().value).toBe('digital');
    expect(preview().queryByLabelText('Words language')).toBeNull();
    expect([blat().checked, bee().checked, overlay(), beeImage()]).toEqual([false, false, null, null]);
    expect(loadPreviewDefaults().appearance.timer).toEqual(options);
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(loadPreviewDefaults().appearance.timer).toEqual({ color: '#3B82F6', font: 'default' });
  });

  it('waits for an upload commit, launches its unsaved ID and saves only metadata explicitly', async () => {
    const id = 'a'.repeat(32);
    let commit!: (asset: fontAssets.CustomFontAsset) => void;
    vi.spyOn(fontAssets, 'importCustomFont').mockImplementation(() => new Promise((resolve) => { commit = resolve; }));
    vi.spyOn(fontAssets, 'loadCustomFont').mockResolvedValue({ face: { family: fontAssets.customFontFamily(id) } as FontFace, name: 'private.woff2' });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: vi.fn(), delete: vi.fn() } });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Timer style'), { target: { value: 'roman' } });
    fireEvent.change(preview().getByLabelText('Custom font file'), { target: { files: [new File(['font'], 'private.woff2')] } });
    expect((preview().getByRole<HTMLButtonElement>('button', { name: 'Launch' })).disabled).toBe(true);
    expect((preview().getByRole<HTMLButtonElement>('button', { name: 'Save Defaults' })).disabled).toBe(true);
    fireEvent.submit(preview().getByRole('button', { name: 'Launch' }).closest('form')!);
    expect(open).not.toHaveBeenCalled();
    await act(async () => commit({ id, name: 'private.woff2', blob: new Blob(['font']) }));
    await waitFor(() => expect(preview().getByLabelText('Timer preview').style.fontFamily).toContain(fontAssets.customFontFamily(id)));
    expect((preview().getByLabelText<HTMLSelectElement>('Timer style')).value).toBe('roman');
    expect(preview().getByLabelText('Timer preview').textContent).toBe('I:IV:III');
    expect(writes).not.toHaveBeenCalled();
    fireEvent.click(preview().getByRole('button', { name: 'Launch' }));
    const url = new URL(open.mock.calls[0][0] as string, 'https://example.com/');
    expect(parsePreviewSettings(url.search).appearance.timer).toEqual({ color: '#3B82F6', font: 'custom', customFontId: id, variant: 'roman' });
    expect(url.search).not.toContain('private');
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'bungee' } });
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'custom' } });
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(loadPreviewDefaults().appearance.timer.customFontId).toBe(id);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(PREVIEW_DEFAULTS_KEY)).not.toContain('private');
    fireEvent.click(preview().getByRole('button', { name: 'Reset' }));
    expect((preview().getByLabelText<HTMLSelectElement>('Timer font')).value).toBe('default');
    expect(loadPreviewDefaults().appearance.timer.customFontId).toBe(id);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it('ignores an upload that completes after Reset', async () => {
    let commit!: (asset: fontAssets.CustomFontAsset) => void;
    vi.spyOn(fontAssets, 'importCustomFont').mockImplementation(() => new Promise((resolve) => { commit = resolve; }));
    const load = vi.spyOn(fontAssets, 'loadCustomFont');
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Custom font file'), { target: { files: [new File(['font'], 'late.woff2')] } });
    fireEvent.click(preview().getByRole('button', { name: 'Reset' }));
    await act(async () => commit({ id: 'a'.repeat(32), name: 'late.woff2', blob: new Blob(['font']) }));
    expect((preview().getByLabelText<HTMLSelectElement>('Timer font')).value).toBe('default');
    expect(preview().queryByRole('option', { name: 'Custom: late.woff2' })).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect((preview().getByRole<HTMLButtonElement>('button', { name: 'Launch' })).disabled).toBe(false);
  });

  it('keeps the prior selection and launch usable after upload failure', async () => {
    vi.spyOn(fontAssets, 'importCustomFont').mockRejectedValue(new fontAssets.CustomFontError('quota', 'Font storage full'));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'bungee' } });
    fireEvent.change(preview().getByLabelText('Custom font file'), { target: { files: [new File(['font'], 'font.woff2')] } });
    await waitFor(() => expect(preview().getByLabelText('Font status').textContent).toBe('Font storage full'));
    expect((preview().getByLabelText<HTMLSelectElement>('Timer font')).value).toBe('bungee');
    fireEvent.click(preview().getByRole('button', { name: 'Launch' }));
    expect(open).toHaveBeenCalledOnce();
    expect(window.localStorage.length).toBe(0);
  });

  it('launches the current unsaved draft, retaining colors on disabled metrics without writing', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const sockets = vi.spyOn(window, 'WebSocket');
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Timer color'), { target: { value: '#123456' } });
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'space-mono' } });
    fireEvent.click(preview().getByRole('button', { name: 'Bonks colors' }));
    fireEvent.change(preview().getByLabelText('Bonks stop 1'), { target: { value: '#123abc' } });
    fireEvent.click(preview().getByRole('checkbox', { name: 'Bonks (milliBonks per minute)' }));
    expect(preview().getByRole('status').textContent).toBe('Unsaved');
    fireEvent.click(preview().getByRole('button', { name: 'Launch' }));
    const settings = parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/nested/').search);
    expect(settings.bonks).toBe(false);
    expect(settings.appearance.timer).toEqual({ color: '#123456', font: 'space-mono' });
    expect(settings.appearance.palettes.bonks[0]).toBe('#123ABC');
    expect(writes).not.toHaveBeenCalled();
    expect(sockets).not.toHaveBeenCalled();
    const legacy = within(screen.getByRole('region', { name: 'v0.0.43-legacy' }));
    expect((legacy.getByRole<HTMLInputElement>('checkbox', { name: 'Bonks (milliBonks per minute)' })).checked).toBe(true);
    fireEvent.click(legacy.getByRole('button', { name: 'Launch' }));
    expect(open.mock.calls[1][0]).not.toContain('appearance');
  });

  it('selects a timer style, keeps it through font edits and disables fonts for graphic styles', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    const style = preview().getByLabelText<HTMLSelectElement>('Timer style');
    const font = preview().getByLabelText<HTMLSelectElement>('Timer font');
    const upload = preview().getByRole<HTMLButtonElement>('button', { name: 'Upload timer font' });
    const sample = () => preview().getByLabelText('Timer preview');
    expect(style.value).toBe('digital');
    expect(sample().textContent).toBe('00:00:00');
    fireEvent.change(style, { target: { value: 'words' } });
    expect(sample().textContent).toBe('One hour, four minutes, and three seconds');
    fireEvent.change(font, { target: { value: 'bungee' } });
    fireEvent.change(preview().getByLabelText('Timer color'), { target: { value: '#123456' } });
    expect(style.value).toBe('words');
    expect(sample().style.fontFamily).not.toBe('');
    for (const variant of ['lcd', 'rings', 'binary']) {
      fireEvent.change(style, { target: { value: variant } });
      expect(font.disabled).toBe(true);
      expect(upload.disabled).toBe(true);
      expect(font.value).toBe('bungee');
      expect(sample().style.fontFamily).toBe('');
      expect(within(sample()).getByRole('img', { name: '01:04:03' })).toBeTruthy();
    }
    fireEvent.change(style, { target: { value: 'analog' } });
    expect(font.disabled).toBe(false);
    expect(upload.disabled).toBe(false);
    fireEvent.click(preview().getByRole('button', { name: 'Launch' }));
    const settings = parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/').search);
    expect(settings.appearance.timer).toEqual({ color: '#123456', font: 'bungee', variant: 'analog' });
    expect(window.localStorage.length).toBe(0);
  });

  it('shows the words language only for Words and keeps it across styles', () => {
    render(<LaunchPage />);
    const style = preview().getByLabelText<HTMLSelectElement>('Timer style');
    const language = () => preview().getByLabelText<HTMLSelectElement>('Words language');
    const sample = () => preview().getByLabelText('Timer preview');
    expect(preview().queryByLabelText('Words language')).toBeNull();
    fireEvent.change(style, { target: { value: 'words' } });
    expect(language().value).toBe('en');
    expect([...language().options].map((option) => [option.value, option.lang, option.textContent])).toEqual([
      ['en', 'en', 'English'], ['fr', 'fr', 'Français'], ['sv', 'sv', 'Svenska'], ['es', 'es', 'Español'], ['ko', 'ko', '한국어'], ['la', 'la', 'Latina'],
      ['ru', 'ru', 'Русский'], ['tlh', 'tlh', 'tlhIngan Hol (Klingon)'], ['qya', 'qya', 'Quenya (Elvish)'], ['emoji', 'en', 'Emoji'], ['mrt', 'en', 'Mr. T'],
    ]);
    fireEvent.change(language(), { target: { value: 'ko' } });
    expect(sample().textContent).toBe('한 시간 사 분 삼 초');
    expect(sample().querySelector('[lang="ko"]')).not.toBeNull();
    fireEvent.change(style, { target: { value: 'roman' } });
    expect(preview().queryByLabelText('Words language')).toBeNull();
    expect(sample().textContent).toBe('I:IV:III');
    fireEvent.change(style, { target: { value: 'words' } });
    expect(language().value).toBe('ko');
    fireEvent.change(language(), { target: { value: 'la' } });
    expect(sample().textContent).toBe('Una hora, quattuor minuta et tria secunda');
  });

  it('selects every style for Rotation, keeps at least two and launches the selection', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    const style = preview().getByLabelText<HTMLSelectElement>('Timer style');
    const font = preview().getByLabelText<HTMLSelectElement>('Timer font');
    expect(preview().queryByRole('group', { name: 'Rotation styles' })).toBeNull();
    fireEvent.change(style, { target: { value: 'rotation' } });
    expect(style.value).toBe('rotation');
    const group = within(preview().getByRole('group', { name: 'Rotation styles' }));
    const option = (name: string) => group.getByRole<HTMLInputElement>('checkbox', { name });
    expect(group.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual(Array(9).fill(true));
    expect(preview().getByLabelText('Words language')).toBeTruthy();
    expect(preview().getByLabelText('Timer preview').textContent).toBe('00:00:00');
    for (const name of ['Digital', 'Words', 'Compact', 'Flip clock', 'Roman numerals', 'Analog stopclock']) fireEvent.click(option(name));
    expect(preview().queryByLabelText('Words language')).toBeNull();
    expect(font.disabled).toBe(true);
    expect((preview().getByRole<HTMLButtonElement>('button', { name: 'Upload timer font' })).disabled).toBe(true);
    expect(option('Progress rings').disabled).toBe(false);
    fireEvent.click(option('Seven-segment LCD'));
    expect(option('Progress rings').disabled).toBe(true);
    expect(option('Binary clock').disabled).toBe(true);
    expect(option('Digital').disabled).toBe(false);
    fireEvent.click(preview().getByRole('button', { name: 'Launch' }));
    expect(parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/').search).appearance.timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'rotation', rotation: ['rings', 'binary'] });
    fireEvent.click(option('Analog stopclock'));
    expect(font.disabled).toBe(false);
    fireEvent.change(style, { target: { value: 'lcd' } });
    expect(preview().queryByRole('group', { name: 'Rotation styles' })).toBeNull();
    expect(window.localStorage.length).toBe(0);
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
    expect((preview().getByLabelText<HTMLInputElement>('Timer color')).value).toBe('#445566');
    fireEvent.click(preview().getByRole('button', { name: 'Reset' }));
    expect((preview().getByLabelText<HTMLInputElement>('Timer color')).value).toBe('#3b82f6');
    expect(writes).not.toHaveBeenCalled();
    view.unmount();
    render(<LaunchPage />);
    expect((preview().getByLabelText<HTMLInputElement>('Timer color')).value).toBe('#445566');
    fireEvent.click(preview().getByRole('button', { name: 'Reset' }));
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(preview().getByRole('status').textContent).toBe('Saved');
    expect(writes).toHaveBeenCalledTimes(1);
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
  });

  it('resets one palette without changing another and keeps launch usable when storage is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    fireEvent.click(preview().getByRole('button', { name: 'Bonks colors' }));
    fireEvent.click(preview().getByRole('button', { name: 'Checks colors' }));
    fireEvent.change(preview().getByLabelText('Bonks stop 1'), { target: { value: '#123456' } });
    fireEvent.change(preview().getByLabelText('Checks stop 1'), { target: { value: '#654321' } });
    fireEvent.click(preview().getByRole('button', { name: 'Reset Bonks colors' }));
    expect((preview().getByLabelText<HTMLInputElement>('Bonks stop 1')).value).toBe('#ffbe0b');
    expect((preview().getByLabelText<HTMLInputElement>('Checks stop 1')).value).toBe('#654321');
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(preview().getByRole('status').textContent).toBe('Save failed');
    fireEvent.click(preview().getByRole('button', { name: 'Launch' }));
    expect(open).toHaveBeenCalledTimes(1);
    const { palettes } = parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/').search).appearance;
    expect(palettes.checkCount[0]).toBe('#654321');
    expect(palettes.bonks).toEqual(METRICS.bonks.colors);
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
    const stored = JSON.parse(window.localStorage.getItem(PREVIEW_DEFAULTS_KEY)!) as Record<string, unknown>;
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

  it.each(['broken', '{"v":2}'])('ignores corrupt or unsupported storage case %# without erasing it', (raw) => {
    window.localStorage.setItem(PREVIEW_DEFAULTS_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const erases = vi.spyOn(Storage.prototype, 'removeItem');
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
    expect(writes).not.toHaveBeenCalled();
    expect(erases).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PREVIEW_DEFAULTS_KEY)).toBe(raw);
  });

  it('falls back safely when storage access, reads or writes are denied', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
    expect(savePreviewDefaults(factoryPreviewDefaults())).toBe(false);
    expect(parsePreviewSettings('').appearance.timer.color).toBe('#3B82F6');
    getter.mockRestore();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(loadPreviewDefaults()).toEqual(factoryPreviewDefaults());
    expect(savePreviewDefaults(factoryPreviewDefaults())).toBe(false);
  });
});