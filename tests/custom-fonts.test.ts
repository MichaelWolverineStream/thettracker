import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { CUSTOM_FONTS_DATABASE, FONT_OPERATION_TIMEOUT, MAX_FONT_BYTES, customFontFamily, importCustomFont, loadCustomFont, validateFontData } from '../src/preview/customFonts';
import * as assets from '../src/preview/customFonts';
import { resolveAppearance } from '../src/preview/appearance';
import { useTimerFont } from '../src/preview/useTimerFont';

const id = '0123456789abcdef0123456789abcdef';
const woff2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32]).buffer;
const file = (name = 'sample.woff2', bytes = woff2) => ({ name, size: bytes.byteLength, arrayBuffer: async () => bytes }) as File;

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
afterEach(() => {
  cleanup();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts); else Reflect.deleteProperty(document, 'fonts');
  vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
});

describe('custom font validation', () => {
  it.each([
    ['font.WOFF2', [0x77, 0x4f, 0x46, 0x32]],
    ['font.woff', [0x77, 0x4f, 0x46, 0x46]],
    ['font.ttf', [0, 1, 0, 0]],
    ['font.otf', [0x4f, 0x54, 0x54, 0x4f]],
  ])('accepts matching font header %s', (name, header) => {
    expect(() => validateFontData(name as string, new Uint8Array(header as number[]).buffer)).not.toThrow();
  });

  it.each(['font.svg', 'font.ttc', 'font.css', 'font', '__proto__', 'constructor'])('rejects unsupported file %s', (name) => {
    expect(() => validateFontData(name, woff2)).toThrow('Choose a WOFF2');
  });

  it('rejects empty, mismatched and oversized contents', () => {
    expect(() => validateFontData('font.woff2', new ArrayBuffer(0))).toThrow('Invalid font');
    expect(() => validateFontData('font.ttf', woff2)).toThrow('Invalid font');
    expect(() => validateFontData('font.woff2', new ArrayBuffer(MAX_FONT_BYTES + 1))).toThrow('5 MiB');
    expect(customFontFamily(id)).toBe(`Tracker Custom ${id}`);
    expect(() => customFontFamily('url(evil)')).toThrow('Invalid font reference');
  });

  it('rejects oversized files before reading bytes', async () => {
    const upload = { ...file(), size: MAX_FONT_BYTES + 1, arrayBuffer: vi.fn() } as unknown as File;
    await expect(importCustomFont(upload)).rejects.toThrow('5 MiB');
    expect(upload.arrayBuffer).not.toHaveBeenCalled();
  });

  it('uses browser decoding to reject damaged font data', async () => {
    vi.stubGlobal('FontFace', class { load() { return Promise.reject(new Error('Invalid outlines')); } });
    await expect(importCustomFont(file())).rejects.toThrow('Invalid font file');
  });

  it('reports missing FontFace support', async () => {
    vi.stubGlobal('FontFace', undefined);
    await expect(importCustomFont(file())).rejects.toThrow('unavailable in this browser');
  });

  it('bounds font decoding and file reads', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('FontFace', class { load() { return new Promise(() => {}); } });
    const decoding = expect(importCustomFont(file())).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(FONT_OPERATION_TIMEOUT);
    await decoding;
    const reading = expect(importCustomFont({ ...file(), arrayBuffer: () => new Promise(() => {}) } as File)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(FONT_OPERATION_TIMEOUT);
    await reading;
  });

  it('handles unavailable storage without registering a font or reading defaults', async () => {
    vi.stubGlobal('FontFace', class { load() { return Promise.resolve(this); } });
    vi.stubGlobal('indexedDB', undefined);
    const reads = vi.spyOn(Storage.prototype, 'getItem');
    await expect(importCustomFont(file())).rejects.toThrow('Font storage unavailable');
    await expect(loadCustomFont(id)).rejects.toThrow('Font storage unavailable');
    expect(reads).not.toHaveBeenCalled();
  });

  it('bounds blocked storage and closes a connection arriving after timeout', async () => {
    vi.useFakeTimers();
    const request: Partial<IDBOpenDBRequest> = {};
    const close = vi.fn();
    const open = vi.fn(() => request);
    vi.stubGlobal('indexedDB', { open });
    const pending = expect(loadCustomFont(id)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(FONT_OPERATION_TIMEOUT);
    await pending;
    expect(open).toHaveBeenCalledWith(CUSTOM_FONTS_DATABASE, 1);
    Object.assign(request, { result: { close } });
    request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success'));
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not create a fonts store on a read-only lookup', async () => {
    const request: Partial<IDBOpenDBRequest> = {};
    const abort = vi.fn();
    const createObjectStore = vi.fn();
    vi.stubGlobal('indexedDB', { open: () => request });
    const pending = expect(loadCustomFont(id)).rejects.toThrow('Custom font unavailable');
    Object.assign(request, { result: { createObjectStore }, transaction: { abort } });
    request.onupgradeneeded?.call(request as IDBOpenDBRequest, new Event('upgradeneeded') as IDBVersionChangeEvent);
    await pending;
    expect(abort).toHaveBeenCalledOnce();
    expect(createObjectStore).not.toHaveBeenCalled();
  });
});

describe('custom font loading lifecycle', () => {
  it('loads no assets for built-in fonts', () => {
    const load = vi.spyOn(assets, 'loadCustomFont');
    const view = renderHook(() => useTimerFont(resolveAppearance({ timer: { font: 'bungee' } }).timer));
    expect(view.result.current.family).toContain('Tracker Bungee');
    expect(load).not.toHaveBeenCalled();
  });

  it('registers only a loaded face and removes it on deselection', async () => {
    const add = vi.fn();
    const remove = vi.fn();
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add, delete: remove } });
    const face = { family: customFontFamily(id) } as FontFace;
    vi.spyOn(assets, 'loadCustomFont').mockResolvedValue({ face, name: 'sample.woff2' });
    const view = renderHook(({ timer }) => useTimerFont(timer), { initialProps: { timer: resolveAppearance({ timer: { font: 'custom', customFontId: id } }).timer } });
    expect(view.result.current.loading).toBe(true);
    expect(view.result.current.family).toBeUndefined();
    await waitFor(() => expect(view.result.current.family).toContain(customFontFamily(id)));
    expect(add).toHaveBeenCalledWith(face);
    expect(view.result.current.name).toBe('sample.woff2');
    view.rerender({ timer: resolveAppearance(undefined).timer });
    expect(remove).toHaveBeenCalledWith(face);
    expect(view.result.current.family).toBeUndefined();
  });

  it('ignores a load that completes after Reset or unmount', async () => {
    let complete!: (font: { face: FontFace; name: string }) => void;
    const add = vi.fn();
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add, delete: vi.fn() } });
    vi.spyOn(assets, 'loadCustomFont').mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const view = renderHook(({ timer }) => useTimerFont(timer), { initialProps: { timer: resolveAppearance({ timer: { font: 'custom', customFontId: id } }).timer } });
    view.rerender({ timer: resolveAppearance(undefined).timer });
    await act(async () => complete({ face: { family: customFontFamily(id) } as FontFace, name: 'sample.woff2' }));
    expect(add).not.toHaveBeenCalled();
    expect(view.result.current.family).toBeUndefined();
    view.rerender({ timer: resolveAppearance({ timer: { font: 'custom', customFontId: id } }).timer });
    view.unmount();
    await act(async () => complete({ face: { family: customFontFamily(id) } as FontFace, name: 'sample.woff2' }));
    expect(add).not.toHaveBeenCalled();
  });

  it('falls back on missing assets without throwing', async () => {
    vi.spyOn(assets, 'loadCustomFont').mockRejectedValue(new assets.CustomFontError('missing', 'Custom font unavailable'));
    const view = renderHook(() => useTimerFont(resolveAppearance({ timer: { font: 'custom', customFontId: id } }).timer));
    await waitFor(() => expect(view.result.current.error).toBe('Custom font unavailable'));
    expect(view.result.current.family).toBeUndefined();
    expect(view.result.current.loading).toBe(false);
  });
});