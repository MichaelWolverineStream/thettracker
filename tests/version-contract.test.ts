import { describe, expect, it } from 'vitest';
import { resolveVersion } from '../src/versionRouting';
import { DEFAULT_LAUNCH_SETTINGS, WIDGETS, buildPreviewUrl, determineBoxCount, parsePreviewSettings } from '../src/preview/config';
import { DEFAULT_LEGACY_SETTINGS, buildLegacyUrl } from '../src/landing/legacyLaunch';
import { METRICS, TIMER_FONTS, parseAppearance, resolveAppearance } from '../src/preview/appearance';

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
    expect(parsePreviewSettings(preview.search)).toEqual({ ...settings, boxes, appearance: resolveAppearance(undefined) });
    for (const { name } of WIDGETS) expect(preview.searchParams.has(name)).toBe(true);
    const legacy = buildLegacyUrl(settings);
    expect(new URL(legacy, preview).searchParams.get('boxes')).toBe(boxes);
    expect(legacy).not.toContain('version=');
    if (count === 0) expect(legacy).toBe('./index.html?tracker=true&&boxes=1');
  });
  it('retains strict flags, first duplicate and verbatim boxes semantics', () => {
    const settings = parsePreviewSettings('?checkCount=false&checkCount=true&bonks=TRUE&deaths=1&rupees=&screens=true&boxes=&boxes=4&unknown=true');
    expect(settings).toEqual({ checkCount: false, bonks: false, chestTurns: false, deaths: false, rupees: false, screens: true, damage: false, magic: false, boxes: '', appearance: resolveAppearance(undefined) });
    expect(parsePreviewSettings('').boxes).toBe('3');
    expect(parsePreviewSettings('?boxes=invalid').boxes).toBe('invalid');
  });
});

describe('appearance URL contract', () => {
  it.each(TIMER_FONTS)('round-trips all 32 custom stops with $label and keeps URLs compact', ({ value }) => {
    const appearance = resolveAppearance(undefined);
    appearance.timer = { color: '#123ABC', font: value };
    WIDGETS.forEach(({ name }, metricIndex) => {
      appearance.palettes[name] = METRICS[name].colors.map((_, stopIndex) => `#${(metricIndex * 16 + stopIndex).toString(16).padStart(6, '0')}`.toUpperCase());
    });
    const url = buildPreviewUrl({ ...DEFAULT_LAUNCH_SETTINGS, boxes: '4', appearance });
    expect(url.length).toBeLessThan(2048);
    expect(parsePreviewSettings(new URL(url, 'https://example.com/nested/').search).appearance).toEqual(appearance);
  });

  it.each([null, '', '{bad', 'null', '[]', '{"v":2}', JSON.stringify({ v: 1, padding: 'x'.repeat(4096) })])('defaults safely for invalid payload case %#', (raw) => {
    expect(parseAppearance(raw)).toEqual(resolveAppearance(undefined));
  });

  it('defaults fields independently, rejects CSS and keeps valid sibling palettes', () => {
    const appearance = parseAppearance(JSON.stringify({
      v: 1,
      timer: { color: '#abcdef', font: 'url(https://example.com/font)' },
      palettes: { checkCount: ['#123456'], bonks: ['#000000', '#111111', '#222222', '#333333', '#444444'], magic: ['red', 'blue', 'green', 'black', 'white'] },
      unknown: 'ignored',
    }));
    expect(appearance.timer).toEqual({ color: '#ABCDEF', font: 'default' });
    expect(appearance.palettes.checkCount).toEqual(METRICS.checkCount.colors);
    expect(appearance.palettes.magic).toEqual(METRICS.magic.colors);
    expect(appearance.palettes.bonks).toEqual(['#000000', '#111111', '#222222', '#333333', '#444444']);
    expect(resolveAppearance({ timer: { color: 'red;display:none', font: 'space-mono' } }).timer).toEqual({ color: '#3B82F6', font: 'space-mono' });
  });

  it('uses the first repeated appearance parameter and has no storage fallback', () => {
    const query = new URLSearchParams();
    query.append('appearance', JSON.stringify({ v: 1, timer: { color: '#112233' } }));
    query.append('appearance', JSON.stringify({ v: 1, timer: { color: '#445566' } }));
    expect(parsePreviewSettings(query.toString()).appearance.timer.color).toBe('#112233');
    expect(parsePreviewSettings('').appearance).toEqual(resolveAppearance(undefined));
    expect(Object.isFrozen(METRICS.checkCount.colors)).toBe(true);
  });

  it('ignores prototype keys and rejects nested arrays, alpha colors and CSS strings', () => {
    const payload = '{"v":1,"__proto__":{"polluted":true},"timer":{"__proto__":{"font":"space-mono"},"color":"#11223344"},"palettes":{"__proto__":{"checkCount":["#112233","#112233","#112233","#112233","#112233"]},"chestTurns":["#112233","rgb(0,0,0)","#445566"]}}';
    expect(parseAppearance(payload)).toEqual(resolveAppearance(undefined));
    expect(parseAppearance('{"v":1,"timer":[],"palettes":[]}')).toEqual(resolveAppearance(undefined));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});