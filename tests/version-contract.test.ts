import { describe, expect, it } from 'vitest';
import { resolveVersion } from '../src/versionRouting';
import { DEFAULT_LAUNCH_SETTINGS, WIDGETS, buildPreviewUrl, determineBoxCount, parsePreviewSettings } from '../src/preview/config';
import { DEFAULT_LEGACY_SETTINGS, buildLegacyUrl } from '../src/landing/legacyLaunch';
import { METRICS, TIMER_VARIANTS, parseAppearance, resolveAppearance, timerLanguage, timerStyles, timerVariant } from '../src/preview/appearance';

describe('version routing', () => {
  it.each(['', '?tracker=TRUE'])('shows landing for %j', (search) => {
    expect(resolveVersion(search)).toBe('landing');
  });
  it.each(['?tracker=true', '?tracker=true&version=unknown'])('keeps legacy for %s', (search) => {
    expect(resolveVersion(search)).toBe('legacy');
  });
  it('selects the new tracker with the stable API version', () => {
    expect(resolveVersion('?tracker=true&version=2')).toBe('preview');
    expect(resolveVersion('?tracker=true&version=2&version=unknown')).toBe('preview');
  });
  it('retains the original preview selector for existing bookmarks', () => {
    expect(resolveVersion('?tracker=true&version=0.1.0-preview')).toBe('preview');
  });
});

describe('launch configuration', () => {
  it('preserves the exact fully enabled legacy link', () => {
    expect(buildLegacyUrl({ ...DEFAULT_LEGACY_SETTINGS })).toBe('./index.html?tracker=true&checkCount=true&bonks=true&chestTurns=true&deaths=true&rupees=true&screens=true&damage=true&magic=true&boxes=4');
  });
  it.each([[0, '1'], [8, '4']])('preserves layout and self-contained URLs with %i widgets', (count, boxes) => {
    const settings = { ...DEFAULT_LAUNCH_SETTINGS };
    WIDGETS.forEach(({ name }, index) => { settings[name] = index < count; });
    expect(determineBoxCount(settings)).toBe(boxes);
    const preview = new URL(buildPreviewUrl({ ...settings, boxes }), 'https://example.com/subdirectory/');
    expect(preview.pathname).toBe('/subdirectory/index.html');
    expect(preview.searchParams.get('version')).toBe('2');
    expect(resolveVersion(preview.search)).toBe('preview');
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
  it('round-trips a custom font reference without font data or filenames and drops it for built-in fonts', () => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'custom', customFontId: '0123456789abcdef0123456789abcdef', filename: 'private.ttf', data: 'bytes' } });
    const url = buildPreviewUrl({ ...DEFAULT_LAUNCH_SETTINGS, boxes: '4', appearance });
    expect(url.length).toBeLessThan(2048);
    expect(parsePreviewSettings(new URL(url, 'https://example.com/nested/').search).appearance).toEqual(appearance);
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'custom', customFontId: '0123456789abcdef0123456789abcdef' });
    expect(url).not.toContain('private');
    expect(url).not.toContain('bytes');
    expect(resolveAppearance({ timer: { font: 'bungee', customFontId: 'a'.repeat(32) } }).timer).toEqual({ color: '#3B82F6', font: 'bungee' });
  });

  it.each(['ABCDEF0123456789ABCDEF0123456789', 'a'.repeat(31), 'url(https://example.com/font)'])('rejects invalid custom font reference %j independently', (customFontId) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'custom', customFontId }, palettes: { chestTurns: ['#000000', '#112233', '#FFFFFF'] } });
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'default' });
    expect(appearance.palettes.chestTurns).toEqual(['#000000', '#112233', '#FFFFFF']);
  });

  it('round-trips a maximal appearance through a compact URL', () => {
    const allStyles = TIMER_VARIANTS.map(({ value }) => value);
    const stops = Object.fromEntries(WIDGETS.map(({ name }, metricIndex) => [
      name,
      METRICS[name].colors.map((_, stopIndex) => `#${(metricIndex * 16 + stopIndex).toString(16).padStart(6, '0')}`.toUpperCase()),
    ]));
    const appearance = resolveAppearance({
      timer: { color: '#123abc', font: 'custom', customFontId: 'c'.repeat(32), variant: 'rotation', rotation: [...allStyles].reverse(), language: 'tlh', blat: true, beebobble: true },
      palettes: stops,
    });
    expect(JSON.stringify(appearance.timer)).toBe(JSON.stringify({ color: '#123ABC', font: 'custom', customFontId: 'c'.repeat(32), variant: 'rotation', rotation: allStyles, language: 'tlh', blat: true, beebobble: true }));
    expect(appearance.palettes).toEqual(stops);
    const url = buildPreviewUrl({ ...DEFAULT_LAUNCH_SETTINGS, boxes: '4', appearance });
    expect(url.length).toBeLessThan(2048);
    expect(parsePreviewSettings(new URL(url, 'https://example.com/nested/').search).appearance).toEqual(appearance);
  });

  it('keeps factory and pre-variant URLs unchanged', () => {
    expect(JSON.stringify(resolveAppearance({ timer: { variant: 'digital' } }))).toBe(JSON.stringify(resolveAppearance(undefined)));
    expect(parseAppearance(JSON.stringify({ v: 1, timer: { color: '#112233', font: 'bungee' } })).timer).toEqual({ color: '#112233', font: 'bungee' });
  });

  it.each(['ANALOG', 'toString', {}])('falls back to digital for invalid timer style %j independently', (variant) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'bungee', variant }, palettes: { chestTurns: ['#000000', '#112233', '#FFFFFF'] } });
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'bungee' });
    expect(appearance.palettes.chestTurns).toEqual(['#000000', '#112233', '#FFFFFF']);
    expect(timerVariant(appearance.timer).value).toBe('digital');
  });

  it.each(['EN', 'fr-FR', 'toString'])('falls back to English for invalid language %j independently', (language) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'bungee', variant: 'words', language } });
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'bungee', variant: 'words' });
    expect(timerLanguage(appearance.timer)).toBe('en');
  });

  it('normalizes rotation lists to registry order and drops them for single timer styles', () => {
    const appearance = resolveAppearance({ timer: { variant: 'rotation', rotation: ['flip', 'rotation', 'analog', 'flip', 'clock', 3, 'analog'] } });
    expect(appearance.timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'rotation', rotation: ['analog', 'flip'] });
    expect(timerStyles(appearance.timer)).toEqual(['analog', 'flip']);
    expect(timerVariant(appearance.timer).value).toBe('analog');
    expect(resolveAppearance({ timer: { variant: 'lcd', rotation: ['analog', 'flip'] } }).timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'lcd' });
    expect(resolveAppearance({ timer: { rotation: ['analog', 'flip'] } }).timer).toEqual({ color: '#3B82F6', font: 'default' });
  });

  it.each([['analog'], [['analog']], [['analog', 'analog', 'Analog']]])('falls back to digital for invalid rotation %j independently', (rotation) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'bungee', variant: 'rotation', rotation, language: 'fr' } });
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'bungee', language: 'fr' });
    expect(timerStyles(appearance.timer)).toEqual(['digital']);
  });

  it.each((['blat', 'beebobble'] as const).flatMap((flag) => ['true', 1, [true]].map((value) => [flag, value] as const)))('omits %s unless it is literally true (given %j)', (flag, value) => {
    expect(resolveAppearance({ timer: { variant: 'binary', [flag]: value } }).timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'binary' });
  });

  it.each(['{bad', '{"v":2}', JSON.stringify({ v: 1, padding: 'x'.repeat(4096) })])('defaults safely for invalid payload case %#', (raw) => {
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
