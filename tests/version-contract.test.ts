import { describe, expect, it } from 'vitest';
import { resolveVersion } from '../src/versionRouting';
import { DEFAULT_LAUNCH_SETTINGS, WIDGETS, buildPreviewUrl, determineBoxCount, parsePreviewSettings } from '../src/preview/config';
import { DEFAULT_LEGACY_SETTINGS, buildLegacyUrl } from '../src/landing/legacyLaunch';
import { METRICS, TIMER_FONTS, TIMER_LANGUAGES, TIMER_VARIANTS, parseAppearance, resolveAppearance, timerLanguage, timerStyles, timerVariant } from '../src/preview/appearance';

describe('version routing', () => {
  it.each(['', '?version=2', '?version=0.1.0-preview', '?tracker=false', '?tracker=TRUE', '?tracker=1', '?tracker=&tracker=true'])('shows landing for %s', (search) => {
    expect(resolveVersion(search)).toBe('landing');
  });
  it.each(['?tracker=true', '?tracker=true&version=', '?tracker=true&version=unknown', '?tracker=true&version=0.0.43-legacy', '?tracker=true&version=unknown&version=0.1.0-preview', '?tracker=true&version=unknown&version=2', '?tracker=true&version=02', '?tracker=true&version=2.1'])('keeps legacy for %s', (search) => {
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
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('preserves layout and self-contained URLs with %i widgets', (count) => {
    const settings = { ...DEFAULT_LAUNCH_SETTINGS };
    WIDGETS.forEach(({ name }, index) => { settings[name] = index < count; });
    const boxes = String([1, 1, 2, 3, 4, 3, 3, 4, 4][count]);
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
  it('round-trips a custom font reference without including font data or filenames', () => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'custom', customFontId: '0123456789abcdef0123456789abcdef', filename: 'private.ttf', data: 'bytes' } });
    const url = buildPreviewUrl({ ...DEFAULT_LAUNCH_SETTINGS, boxes: '4', appearance });
    expect(url.length).toBeLessThan(2048);
    expect(parsePreviewSettings(new URL(url, 'https://example.com/nested/').search).appearance).toEqual(appearance);
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'custom', customFontId: '0123456789abcdef0123456789abcdef' });
    expect(url).not.toContain('private');
    expect(url).not.toContain('bytes');
  });

  it.each([undefined, null, '', 'ABCDEF0123456789ABCDEF0123456789', 'a'.repeat(31), 'a'.repeat(33), 'url(https://example.com/font)', {}, ['a'.repeat(32)]])('rejects invalid custom font references case %# independently', (customFontId) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'custom', customFontId }, palettes: { chestTurns: ['#000000', '#112233', '#FFFFFF'] } });
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'default' });
    expect(appearance.palettes.chestTurns).toEqual(['#000000', '#112233', '#FFFFFF']);
  });

  it.each(TIMER_VARIANTS)('round-trips the $label timer style and omits the digital default', ({ value }) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'custom', customFontId: 'b'.repeat(32), variant: value } });
    const url = buildPreviewUrl({ ...DEFAULT_LAUNCH_SETTINGS, boxes: '4', appearance });
    expect(url.length).toBeLessThan(2048);
    expect(parsePreviewSettings(new URL(url, 'https://example.com/nested/').search).appearance).toEqual(appearance);
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'custom', customFontId: 'b'.repeat(32), ...(value === 'digital' ? {} : { variant: value }) });
    expect(timerVariant(appearance.timer).value).toBe(value);
  });

  it('keeps factory and pre-variant URLs unchanged', () => {
    expect(JSON.stringify(resolveAppearance({ timer: { variant: 'digital' } }))).toBe(JSON.stringify(resolveAppearance(undefined)));
    expect(parseAppearance(JSON.stringify({ v: 1, timer: { color: '#112233', font: 'bungee' } })).timer).toEqual({ color: '#112233', font: 'bungee' });
  });

  it.each([undefined, null, '', 'Analog', 'ANALOG', 'clock', 'toString', 1, {}, ['analog']])('falls back to digital for invalid timer style case %# independently', (variant) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'bungee', variant }, palettes: { chestTurns: ['#000000', '#112233', '#FFFFFF'] } });
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'bungee' });
    expect(appearance.palettes.chestTurns).toEqual(['#000000', '#112233', '#FFFFFF']);
    expect(timerVariant(appearance.timer).value).toBe('digital');
  });

  it.each(TIMER_LANGUAGES)('round-trips the $label words language and omits the English default', ({ value }) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'bungee', variant: 'words', language: value } });
    const url = buildPreviewUrl({ ...DEFAULT_LAUNCH_SETTINGS, boxes: '4', appearance });
    expect(parsePreviewSettings(new URL(url, 'https://example.com/nested/').search).appearance).toEqual(appearance);
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'bungee', variant: 'words', ...(value === 'en' ? {} : { language: value }) });
    expect(timerLanguage(appearance.timer)).toBe(value);
  });

  it('keeps the words language independent of the timer style', () => {
    expect(resolveAppearance({ timer: { variant: 'roman', language: 'ko' } }).timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'roman', language: 'ko' });
    expect(resolveAppearance({ timer: { language: 'la' } }).timer).toEqual({ color: '#3B82F6', font: 'default', language: 'la' });
  });

  it.each([undefined, null, '', 'en', 'EN', 'fr-FR', 'de', 'toString', 1, {}, ['fr']])('falls back to English for invalid language case %# independently', (language) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'bungee', variant: 'words', language } });
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'bungee', variant: 'words' });
    expect(timerLanguage(appearance.timer)).toBe('en');
  });

  it('discards custom metadata when a built-in font is selected', () => {
    expect(resolveAppearance({ timer: { font: 'bungee', customFontId: 'a'.repeat(32) } }).timer).toEqual({ color: '#3B82F6', font: 'bungee' });
  });

  it('round-trips every style in rotation with BLAT and keeps URLs compact', () => {
    const all = TIMER_VARIANTS.map(({ value }) => value);
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'custom', customFontId: 'c'.repeat(32), variant: 'rotation', rotation: [...all].reverse(), language: 'tlh', blat: true } });
    const url = buildPreviewUrl({ ...DEFAULT_LAUNCH_SETTINGS, boxes: '4', appearance });
    expect(url.length).toBeLessThan(2048);
    expect(parsePreviewSettings(new URL(url, 'https://example.com/nested/').search).appearance).toEqual(appearance);
    expect(JSON.stringify(appearance.timer)).toBe(JSON.stringify({ color: '#123ABC', font: 'custom', customFontId: 'c'.repeat(32), variant: 'rotation', rotation: all, language: 'tlh', blat: true }));
    expect(timerStyles(appearance.timer)).toEqual(all);
    expect(timerVariant(appearance.timer).value).toBe('digital');
  });

  it('normalizes rotation lists to registry order without duplicates or unknown styles', () => {
    const appearance = resolveAppearance({ timer: { variant: 'rotation', rotation: ['flip', 'rotation', 'analog', 'flip', 'clock', 3, 'analog'] } });
    expect(appearance.timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'rotation', rotation: ['analog', 'flip'] });
    expect(timerStyles(appearance.timer)).toEqual(['analog', 'flip']);
    expect(timerVariant(appearance.timer).value).toBe('analog');
  });

  it.each([undefined, null, 'analog', {}, [], ['analog'], ['analog', 'analog'], ['rotation', 'flip'], ['clock', 'Analog']])('falls back to digital for invalid rotation case %# independently', (rotation) => {
    const appearance = resolveAppearance({ timer: { color: '#123abc', font: 'bungee', variant: 'rotation', rotation, language: 'fr' } });
    expect(appearance.timer).toEqual({ color: '#123ABC', font: 'bungee', language: 'fr' });
    expect(timerStyles(appearance.timer)).toEqual(['digital']);
  });

  it('drops rotation lists for single timer styles', () => {
    expect(resolveAppearance({ timer: { variant: 'lcd', rotation: ['analog', 'flip'] } }).timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'lcd' });
    expect(resolveAppearance({ timer: { rotation: ['analog', 'flip'] } }).timer).toEqual({ color: '#3B82F6', font: 'default' });
  });

  it.each([undefined, null, false, 'true', 1, {}, [true]])('omits BLAT unless it is literally true, case %#', (blat) => {
    expect(resolveAppearance({ timer: { variant: 'binary', blat } }).timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'binary' });
    expect(resolveAppearance({ timer: { variant: 'binary', blat: true } }).timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'binary', blat: true });
  });

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