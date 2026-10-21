export const TRACKER_API_VERSION = '2';
// Selector used by the first preview release's links; kept so existing bookmarks still open preview.
export const ORIGINAL_PREVIEW_VERSION = '0.1.0-preview';

export function resolveVersion(search: string): 'landing' | 'legacy' | 'preview' {
  const params = new URLSearchParams(search);
  if (params.get('tracker') !== 'true') return 'landing';
  const version = params.get('version');
  return version === TRACKER_API_VERSION || version === ORIGINAL_PREVIEW_VERSION ? 'preview' : 'legacy';
}