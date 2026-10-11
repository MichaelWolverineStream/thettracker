export const PREVIEW_VERSION = '0.1.0-preview';

export function resolveVersion(search: string): 'landing' | 'legacy' | 'preview' {
  const params = new URLSearchParams(search);
  if (params.get('tracker') !== 'true') return 'landing';
  return params.get('version') === PREVIEW_VERSION ? 'preview' : 'legacy';
}