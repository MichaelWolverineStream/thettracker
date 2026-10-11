import { isCustomFontId, isRecord } from './appearance';

export const CUSTOM_FONTS_DATABASE = 'thettracker:preview:fonts';
export const MAX_FONT_BYTES = 5 * 1024 * 1024;
export const FONT_OPERATION_TIMEOUT = 5000;

export interface CustomFontAsset {
  id: string;
  name: string;
  blob: Blob;
}

export class CustomFontError extends Error {
  readonly code: 'unsupported' | 'invalid' | 'too-large' | 'storage' | 'quota' | 'missing' | 'timeout';

  constructor(code: CustomFontError['code'], message: string) {
    super(message);
    this.name = 'CustomFontError';
    this.code = code;
  }
}

export function fontErrorMessage(error: unknown): string {
  return error instanceof CustomFontError ? error.message : 'Font storage unavailable';
}

function storageError(error: unknown): CustomFontError {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
    ? new CustomFontError('quota', 'Font storage full')
    : new CustomFontError('storage', 'Font storage unavailable');
}

function bounded<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new CustomFontError('timeout', 'Font operation timed out')), FONT_OPERATION_TIMEOUT);
    operation.then((result) => { clearTimeout(timeout); resolve(result); }, (error) => { clearTimeout(timeout); reject(error); });
  });
}

export function validateFontData(name: string, bytes: ArrayBuffer): void {
  const signatures: Record<string, readonly number[]> = {
    woff2: [0x77, 0x4f, 0x46, 0x32],
    woff: [0x77, 0x4f, 0x46, 0x46],
    ttf: [0x00, 0x01, 0x00, 0x00],
    otf: [0x4f, 0x54, 0x54, 0x4f],
  };
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const signature = Object.prototype.hasOwnProperty.call(signatures, extension) ? signatures[extension] : undefined;
  if (!signature) throw new CustomFontError('unsupported', 'Choose a WOFF2, WOFF, TTF, or OTF font');
  if (bytes.byteLength > MAX_FONT_BYTES) throw new CustomFontError('too-large', 'Font exceeds 5 MiB');
  const header = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (header.length !== 4 || !signature.every((byte, index) => header[index] === byte)) {
    throw new CustomFontError('invalid', 'Invalid font file');
  }
}

export function customFontFamily(id: string): string {
  if (!isCustomFontId(id)) throw new CustomFontError('invalid', 'Invalid font reference');
  return `Tracker Custom ${id}`;
}

async function decodeFont(id: string, bytes: ArrayBuffer): Promise<FontFace> {
  if (typeof FontFace === 'undefined') throw new CustomFontError('unsupported', 'Custom fonts unavailable in this browser');
  try {
    const face = new FontFace(customFontFamily(id), bytes, { style: 'normal', weight: '400 700' });
    return await bounded(face.load());
  } catch (error) {
    if (error instanceof CustomFontError) throw error;
    throw new CustomFontError('invalid', 'Invalid font file');
  }
}

function fontStore(value: string | CustomFontAsset): Promise<unknown> {
  const mode = typeof value === 'string' ? 'readonly' : 'readwrite';
  return new Promise((resolve, reject) => {
    let database: IDBDatabase | undefined;
    let transaction: IDBTransaction | undefined;
    let settled = false;
    const finish = (error?: CustomFontError, result?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        try { transaction?.abort(); } catch { transaction = undefined; }
      }
      database?.close();
      if (error) reject(error); else resolve(result);
    };
    const timeout = window.setTimeout(() => finish(new CustomFontError('timeout', 'Font operation timed out')), FONT_OPERATION_TIMEOUT);
    try {
      const request = window.indexedDB.open(CUSTOM_FONTS_DATABASE, 1);
      request.onblocked = () => finish(new CustomFontError('storage', 'Font storage is busy'));
      request.onerror = () => finish(storageError(request.error));
      request.onupgradeneeded = () => {
        if (settled || mode === 'readonly') {
          request.transaction?.abort();
          finish(new CustomFontError('missing', 'Custom font unavailable'));
          return;
        }
        request.result.createObjectStore('fonts', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        database = request.result;
        if (settled) { database.close(); return; }
        database.onversionchange = () => { database?.close(); finish(new CustomFontError('storage', 'Font storage changed')); };
        try {
          transaction = database.transaction('fonts', mode);
          let result: unknown;
          transaction.onabort = () => finish(storageError(transaction?.error));
          transaction.onerror = () => finish(storageError(transaction?.error));
          transaction.oncomplete = () => finish(undefined, result);
          const store = transaction.objectStore('fonts');
          const query = typeof value === 'string' ? store.get(value) : store.add(value);
          query.onsuccess = () => { result = query.result; };
          query.onerror = () => finish(storageError(query.error));
        } catch (error) { finish(storageError(error)); }
      };
    } catch (error) { finish(storageError(error)); }
  });
}

export async function importCustomFont(file: File): Promise<CustomFontAsset> {
  if (file.size > MAX_FONT_BYTES) throw new CustomFontError('too-large', 'Font exceeds 5 MiB');
  if (!file.size) throw new CustomFontError('invalid', 'Invalid font file');
  const bytes = await bounded(file.arrayBuffer());
  validateFontData(file.name, bytes);
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  await decodeFont(id, bytes);
  const cleanName = file.name.replace(/\p{Cc}/gu, '').trim();
  const suffix = cleanName.slice(cleanName.lastIndexOf('.'));
  const name = cleanName.slice(0, Math.min(cleanName.lastIndexOf('.'), 120 - suffix.length)) + suffix;
  const asset: CustomFontAsset = { id, name, blob: new Blob([bytes]) };
  await fontStore(asset);
  return asset;
}

export async function loadCustomFont(id: string): Promise<{ face: FontFace; name: string }> {
  customFontFamily(id);
  const asset = await fontStore(id);
  if (asset === undefined) throw new CustomFontError('missing', 'Custom font unavailable');
  if (!isRecord(asset) || asset.id !== id || typeof asset.name !== 'string' || !asset.name.length || asset.name.length > 120 || !(asset.blob instanceof Blob)) {
    throw new CustomFontError('invalid', 'Invalid stored font');
  }
  if (asset.blob.size > MAX_FONT_BYTES) throw new CustomFontError('too-large', 'Font exceeds 5 MiB');
  const bytes = await bounded(asset.blob.arrayBuffer());
  validateFontData(asset.name, bytes);
  return { face: await decodeFont(id, bytes), name: asset.name };
}