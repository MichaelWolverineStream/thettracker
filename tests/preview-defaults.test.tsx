import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LaunchPage from '../src/landing/LaunchPage';
import { parsePreviewSettings } from '../src/preview/config';
import { METRICS } from '../src/preview/appearance';
import * as fontAssets from '../src/preview/customFonts';
import { MAX_DEFAULTS_LENGTH, PREVIEW_DEFAULTS_KEY, factoryPreviewDefaults, loadPreviewDefaults, savePreviewDefaults } from '../src/landing/previewDefaults';

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
afterEach(() => {
  cleanup();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts); else Reflect.deleteProperty(document, 'fonts');
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('preview editor draft and save lifecycle', () => {
  const preview = () => within(screen.getByRole('region', { name: 'v0.1.0-preview' }));

  it('waits for an upload commit, launches its unsaved ID and saves only metadata explicitly', async () => {
    const id = 'a'.repeat(32);
    let commit!: (asset: fontAssets.CustomFontAsset) => void;
    vi.spyOn(fontAssets, 'importCustomFont').mockImplementation(() => new Promise((resolve) => { commit = resolve; }));
    vi.spyOn(fontAssets, 'loadCustomFont').mockResolvedValue({ face: { family: fontAssets.customFontFamily(id) } as FontFace, name: 'private.woff2' });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: vi.fn(), delete: vi.fn() } });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Custom font file'), { target: { files: [new File(['font'], 'private.woff2')] } });
    expect((preview().getByRole('button', { name: 'Launch', exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect((preview().getByRole('button', { name: 'Save Defaults' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(preview().getByRole('button', { name: 'Launch', exact: true }).closest('form')!);
    expect(open).not.toHaveBeenCalled();
    await act(async () => commit({ id, name: 'private.woff2', blob: new Blob(['font']) }));
    await waitFor(() => expect(preview().getByLabelText('Timer preview').style.fontFamily).toContain(fontAssets.customFontFamily(id)));
    expect(writes).not.toHaveBeenCalled();
    fireEvent.click(preview().getByRole('button', { name: 'Launch', exact: true }));
    const url = new URL(open.mock.calls[0][0] as string, 'https://example.com/');
    expect(parsePreviewSettings(url.search).appearance.timer).toEqual({ color: '#3B82F6', font: 'custom', customFontId: id });
    expect(url.search).not.toContain('private');
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'bungee' } });
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'custom' } });
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(loadPreviewDefaults().appearance.timer.customFontId).toBe(id);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(PREVIEW_DEFAULTS_KEY)).not.toContain('private');
    fireEvent.click(preview().getByRole('button', { name: 'Reset', exact: true }));
    expect((preview().getByLabelText('Timer font') as HTMLSelectElement).value).toBe('default');
    expect(loadPreviewDefaults().appearance.timer.customFontId).toBe(id);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it('ignores an upload that completes after Reset', async () => {
    let commit!: (asset: fontAssets.CustomFontAsset) => void;
    vi.spyOn(fontAssets, 'importCustomFont').mockImplementation(() => new Promise((resolve) => { commit = resolve; }));
    const load = vi.spyOn(fontAssets, 'loadCustomFont');
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Custom font file'), { target: { files: [new File(['font'], 'late.woff2')] } });
    fireEvent.click(preview().getByRole('button', { name: 'Reset', exact: true }));
    await act(async () => commit({ id: 'a'.repeat(32), name: 'late.woff2', blob: new Blob(['font']) }));
    expect((preview().getByLabelText('Timer font') as HTMLSelectElement).value).toBe('default');
    expect(preview().queryByRole('option', { name: 'Custom: late.woff2' })).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect((preview().getByRole('button', { name: 'Launch', exact: true }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps the prior selection and launch usable after upload failure', async () => {
    vi.spyOn(fontAssets, 'importCustomFont').mockRejectedValue(new fontAssets.CustomFontError('quota', 'Font storage full'));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'bungee' } });
    fireEvent.change(preview().getByLabelText('Custom font file'), { target: { files: [new File(['font'], 'font.woff2')] } });
    await waitFor(() => expect(preview().getByLabelText('Font status').textContent).toBe('Font storage full'));
    expect((preview().getByLabelText('Timer font') as HTMLSelectElement).value).toBe('bungee');
    fireEvent.click(preview().getByRole('button', { name: 'Launch', exact: true }));
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

  it('selects a timer style, keeps it through font edits and disables fonts for graphic styles', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    const style = preview().getByLabelText('Timer style') as HTMLSelectElement;
    const font = preview().getByLabelText('Timer font') as HTMLSelectElement;
    const upload = preview().getByRole('button', { name: 'Upload timer font' }) as HTMLButtonElement;
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
    fireEvent.click(preview().getByRole('button', { name: 'Launch', exact: true }));
    const settings = parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/').search);
    expect(settings.appearance.timer).toEqual({ color: '#123456', font: 'bungee', variant: 'analog' });
    expect(window.localStorage.length).toBe(0);
  });

  it('keeps the timer style when uploading a font', async () => {
    const id = 'c'.repeat(32);
    vi.spyOn(fontAssets, 'importCustomFont').mockResolvedValue({ id, name: 'mine.woff2', blob: new Blob(['font']) });
    vi.spyOn(fontAssets, 'loadCustomFont').mockResolvedValue({ face: { family: fontAssets.customFontFamily(id) } as FontFace, name: 'mine.woff2' });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: vi.fn(), delete: vi.fn() } });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    fireEvent.change(preview().getByLabelText('Timer style'), { target: { value: 'roman' } });
    fireEvent.change(preview().getByLabelText('Custom font file'), { target: { files: [new File(['font'], 'mine.woff2')] } });
    await waitFor(() => expect((preview().getByLabelText('Timer font') as HTMLSelectElement).value).toBe('custom'));
    expect((preview().getByLabelText('Timer style') as HTMLSelectElement).value).toBe('roman');
    expect(preview().getByLabelText('Timer preview').textContent).toBe('I:IV:III');
    fireEvent.click(preview().getByRole('button', { name: 'Launch', exact: true }));
    expect(parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/').search).appearance.timer).toEqual({ color: '#3B82F6', font: 'custom', customFontId: id, variant: 'roman' });
  });

  it('saves and resets the timer style without false unsaved changes', () => {
    render(<LaunchPage />);
    const style = () => preview().getByLabelText('Timer style') as HTMLSelectElement;
    const status = () => preview().getByRole('status').textContent;
    fireEvent.change(style(), { target: { value: 'flip' } });
    expect(status()).toBe('Unsaved');
    fireEvent.change(style(), { target: { value: 'digital' } });
    expect(status()).toBe('');
    fireEvent.change(style(), { target: { value: 'flip' } });
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(status()).toBe('Saved');
    expect(loadPreviewDefaults().appearance.timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'flip' });
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'bungee' } });
    fireEvent.change(preview().getByLabelText('Timer font'), { target: { value: 'default' } });
    expect(status()).toBe('');
    fireEvent.click(preview().getByRole('button', { name: 'Reset', exact: true }));
    expect(style().value).toBe('digital');
    expect(loadPreviewDefaults().appearance.timer.variant).toBe('flip');
    cleanup();
    render(<LaunchPage />);
    expect(style().value).toBe('flip');
  });

  it('shows the words language only for Words, keeps it across styles and launches it', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<LaunchPage />);
    const style = preview().getByLabelText('Timer style') as HTMLSelectElement;
    const language = () => preview().getByLabelText('Words language') as HTMLSelectElement;
    const sample = () => preview().getByLabelText('Timer preview');
    expect(preview().queryByLabelText('Words language')).toBeNull();
    fireEvent.change(style, { target: { value: 'words' } });
    expect(language().value).toBe('en');
    expect([...language().options].map((option) => [option.value, option.lang, option.textContent])).toEqual([
      ['en', 'en', 'English'], ['fr', 'fr', 'Français'], ['sv', 'sv', 'Svenska'], ['es', 'es', 'Español'], ['ko', 'ko', '한국어'], ['la', 'la', 'Latina'],
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
    fireEvent.click(preview().getByRole('button', { name: 'Launch', exact: true }));
    expect(parsePreviewSettings(new URL(open.mock.calls[0][0] as string, 'https://example.com/').search).appearance.timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'words', language: 'la' });
    expect(window.localStorage.length).toBe(0);
  });

  it('saves and resets the words language without false unsaved changes', () => {
    render(<LaunchPage />);
    const language = () => preview().getByLabelText('Words language') as HTMLSelectElement;
    const status = () => preview().getByRole('status').textContent;
    fireEvent.change(preview().getByLabelText('Timer style'), { target: { value: 'words' } });
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    fireEvent.change(language(), { target: { value: 'fr' } });
    expect(status()).toBe('Unsaved');
    fireEvent.change(language(), { target: { value: 'en' } });
    expect(status()).toBe('');
    fireEvent.change(language(), { target: { value: 'sv' } });
    fireEvent.click(preview().getByRole('button', { name: 'Save Defaults' }));
    expect(status()).toBe('Saved');
    expect(loadPreviewDefaults().appearance.timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'words', language: 'sv' });
    expect(preview().getByLabelText('Timer preview').textContent).toBe('En timme, fyra minuter och tre sekunder');
    fireEvent.click(preview().getByRole('button', { name: 'Reset', exact: true }));
    expect(preview().queryByLabelText('Words language')).toBeNull();
    expect(loadPreviewDefaults().appearance.timer.language).toBe('sv');
    cleanup();
    render(<LaunchPage />);
    expect(language().value).toBe('sv');
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