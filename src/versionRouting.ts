export const TRACKER_API_VERSION = '2';
export const PREVIEW_VERSION = '0.1.0-preview';

export function resolveVersion(search: string): 'landing' | 'legacy' | 'preview' {
  const params = new URLSearchParams(search);
  if (params.get('tracker') !== 'true') return 'landing';
  const version = params.get('version');
  return version === TRACKER_API_VERSION || version === PREVIEW_VERSION ? 'preview' : 'legacy';
}