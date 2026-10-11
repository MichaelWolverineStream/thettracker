import { describe, expect, it } from 'vitest';
import { resolveVersion } from '../src/versionRouting';
import { DEFAULT_LAUNCH_SETTINGS, WIDGETS, buildPreviewUrl, determineBoxCount, parsePreviewSettings } from '../src/preview/config';
import { DEFAULT_LEGACY_SETTINGS, buildLegacyUrl } from '../src/landing/legacyLaunch';

describe('version routing', () => {
  it.each(['', '?version=0.1.0-preview', '?tracker=false', '?tracker=TRUE', '?tracker=1', '?tracker=&tracker=true'])('shows landing for %s', (search) => {
    expect(resolveVersion(search)).toBe('landing');
  });
  it.each(['?tracker=true', '?tracker=true&version=', '?tracker=true&version=unknown', '?tracker=true&version=0.0.43-legacy', '?tracker=true&version=unknown&version=0.1.0-preview'])('keeps legacy for %s', (search) => {
    expect(resolveVersion(search)).toBe('legacy');
  });
  it('selects only the explicit preview version', () => {
    expect(resolveVersion('?tracker=true&version=0.1.0-preview')).toBe('preview');
  });
});

describe('launch configuration', () => {
  it('preserves the exact fully enabled legacy link', () => {
    expect(buildLegacyUrl({ ...DEFAULT_LEGACY_SETTINGS })).toBe('./index.html?tracker=true&checkCount=true&bonks=true&chestTurns=true&deaths=true&rupees=true&screens=true&damage=true&magic=true&boxes=4');
  });
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('preserves layout and self-contained URLs with %i widgets', (count) => {
    const settings = { ...DEFAULT_LAUNCH_SETTINGS };
    WIDGETS.forEach(({ name }, index) => { settings[name] = index < count; });
    const boxes = String([1, 1, 2, 3, 4, 3, 3, 4, 4][count]);
    expect(determineBoxCount(settings)).toBe(boxes);
    const preview = new URL(buildPreviewUrl({ ...settings, boxes }), 'https://example.com/subdirectory/');
    expect(preview.pathname).toBe('/subdirectory/index.html');
    expect(preview.searchParams.get('version')).toBe('0.1.0-preview');
    expect(parsePreviewSettings(preview.search)).toEqual({ ...settings, boxes });
    for (const { name } of WIDGETS) expect(preview.searchParams.has(name)).toBe(true);
    const legacy = buildLegacyUrl(settings);
    expect(new URL(legacy, preview).searchParams.get('boxes')).toBe(boxes);
    expect(legacy).not.toContain('version=');
    if (count === 0) expect(legacy).toBe('./index.html?tracker=true&&boxes=1');
  });
  it('retains strict flags, first duplicate and verbatim boxes semantics', () => {
    const settings = parsePreviewSettings('?checkCount=false&checkCount=true&bonks=TRUE&deaths=1&rupees=&screens=true&boxes=&boxes=4&unknown=true');
    expect(settings).toEqual({ checkCount: false, bonks: false, chestTurns: false, deaths: false, rupees: false, screens: true, damage: false, magic: false, boxes: '' });
    expect(parsePreviewSettings('').boxes).toBe('3');
    expect(parsePreviewSettings('?boxes=invalid').boxes).toBe('invalid');
  });
});