import type { WidgetName } from './config';

export const TIMER_FONTS = [
  { value: 'default', label: 'Current', family: undefined },
  { value: 'ibm-plex-mono', label: 'IBM Plex Mono', family: '"Tracker IBM Plex Mono", monospace' },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', family: '"Tracker JetBrains Mono", monospace' },
  { value: 'space-mono', label: 'Space Mono', family: '"Tracker Space Mono", monospace' },
  { value: 'bungee', label: 'Bungee', family: '"Tracker Bungee", monospace' },
  { value: 'audiowide', label: 'Audiowide', family: '"Tracker Audiowide", monospace' },
  { value: 'monoton', label: 'Monoton', family: '"Tracker Monoton", monospace' },
] as const;

export const TIMER_VARIANTS = [
  { value: 'digital', label: 'Digital', usesFont: true, layout: 'line' },
  { value: 'analog', label: 'Analog stopclock', usesFont: true, layout: 'graphic' },
  { value: 'words', label: 'Words', usesFont: true, layout: 'wrap' },
  { value: 'lcd', label: 'Seven-segment LCD', usesFont: false, layout: 'graphic' },
  { value: 'rings', label: 'Progress rings', usesFont: false, layout: 'graphic' },
  { value: 'binary', label: 'Binary clock', usesFont: false, layout: 'graphic' },
  { value: 'compact', label: 'Compact', usesFont: true, layout: 'line' },
  { value: 'flip', label: 'Flip clock', usesFont: true, layout: 'line' },
  { value: 'roman', label: 'Roman numerals', usesFont: true, layout: 'line' },
] as const;

// `lang` is the HTML language tag; novelty styles without their own tag read as English.
export const TIMER_LANGUAGES = [
  { value: 'en', label: 'English', lang: 'en' },
  { value: 'fr', label: 'Français', lang: 'fr' },
  { value: 'sv', label: 'Svenska', lang: 'sv' },
  { value: 'es', label: 'Español', lang: 'es' },
  { value: 'ko', label: '한국어', lang: 'ko' },
  { value: 'la', label: 'Latina', lang: 'la' },
  { value: 'ru', label: 'Русский', lang: 'ru' },
  { value: 'tlh', label: 'tlhIngan Hol (Klingon)', lang: 'tlh' },
  { value: 'qya', label: 'Quenya (Elvish)', lang: 'qya' },
  { value: 'emoji', label: 'Emoji', lang: 'en' },
  { value: 'mrt', label: 'Mr. T', lang: 'en' },
] as const;

export type TimerFont = typeof TIMER_FONTS[number]['value'] | 'custom';
export type TimerVariant = typeof TIMER_VARIANTS[number]['value'];
export type TimerLanguage = typeof TIMER_LANGUAGES[number]['value'];
export interface AppearanceSettings {
  timer: { color: string; font: TimerFont; customFontId?: string; variant?: Exclude<TimerVariant, 'digital'>; language?: Exclude<TimerLanguage, 'en'> };
  palettes: Record<WidgetName, readonly string[]>;
}

const BLUE = '#3A86FF';
const PURPLE = '#8338EC';
const PINK = '#FF006E';
const ORANGE = '#FB5607';
const YELLOW = '#FFBE0B';

export const METRICS = {
  checkCount: { title: 'Checks', unit: 'cph', buckets: [70, 85, 100, 115, 130], colors: [BLUE, PURPLE, PINK, ORANGE, YELLOW] },
  bonks: { title: 'Bonks', unit: 'mBpm', buckets: [0, 100, 200, 400, 800], colors: [YELLOW, ORANGE, PINK, PURPLE, BLUE] },
  chestTurns: { title: 'Chest Turns', unit: 'ctph', buckets: [0, 10, 25], colors: [BLUE, ORANGE, YELLOW] },
  deaths: { title: 'Deaths', unit: 'Mdpm', buckets: [0, 1, 5, 20, 50], colors: [YELLOW, ORANGE, PINK, PURPLE, BLUE] },
  rupees: { title: 'Rupees Spent', unit: 'rph', buckets: [0, 1000, 3000], colors: [BLUE, PINK, YELLOW] },
  screens: { title: 'Screens', unit: 'sph', buckets: [0, 400, 800], colors: [BLUE, PINK, YELLOW] },
  damage: { title: 'Hearts Lost', unit: 'dph', buckets: [0, 25, 100], colors: [BLUE, PINK, YELLOW] },
  magic: { title: 'Magic Bars', unit: 'mph', buckets: [0, 50, 100, 200, 400], colors: [BLUE, PURPLE, PINK, ORANGE, YELLOW] },
} as const;

for (const metric of Object.values(METRICS)) {
  Object.freeze(metric.buckets);
  Object.freeze(metric.colors);
  Object.freeze(metric);
}
Object.freeze(METRICS);

export const LARGE_CHECK_BUCKETS = Object.freeze([150, 250, 350, 450, 550]);
export const DEFAULT_TIMER_COLOR = '#3B82F6';
export const MAX_APPEARANCE_LENGTH = 4096;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : undefined;
}

export function isCustomFontId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
}

export function resolveAppearance(value: unknown): AppearanceSettings {
  const input = isRecord(value) ? value : {};
  const timer = isRecord(input.timer) ? input.timer : {};
  const palettes = isRecord(input.palettes) ? input.palettes : {};
  const customFontId = timer.font === 'custom' && isCustomFontId(timer.customFontId) ? timer.customFontId : undefined;
  const font: TimerFont = customFontId ? 'custom' : TIMER_FONTS.find((option) => option.value === timer.font)?.value ?? 'default';
  const variant = TIMER_VARIANTS.find((option) => option.value === timer.variant && option.value !== 'digital')?.value as AppearanceSettings['timer']['variant'];
  const language = TIMER_LANGUAGES.find((option) => option.value === timer.language && option.value !== 'en')?.value as AppearanceSettings['timer']['language'];
  const resolved = {} as AppearanceSettings['palettes'];
  for (const name of Object.keys(METRICS) as WidgetName[]) {
    const colors: unknown = palettes[name];
    resolved[name] = Array.isArray(colors) && colors.length === METRICS[name].colors.length && colors.every((color) => normalizeColor(color))
      ? colors.map((color) => normalizeColor(color)!)
      : [...METRICS[name].colors];
  }
  return { timer: { color: normalizeColor(timer.color) ?? DEFAULT_TIMER_COLOR, font, ...(customFontId ? { customFontId } : {}), ...(variant ? { variant } : {}), ...(language ? { language } : {}) }, palettes: resolved };
}

export function timerVariant(timer: AppearanceSettings['timer']) {
  return TIMER_VARIANTS.find((option) => option.value === (timer.variant ?? 'digital'))!;
}

export function timerLanguage(timer: AppearanceSettings['timer']): TimerLanguage {
  return timer.language ?? 'en';
}

export function languageTag(language: TimerLanguage): string {
  return TIMER_LANGUAGES.find((option) => option.value === language)!.lang;
}

export function parseAppearance(raw: string | null): AppearanceSettings {
  if (!raw || raw.length > MAX_APPEARANCE_LENGTH) return resolveAppearance(undefined);
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) && value.v === 1 ? resolveAppearance(value) : resolveAppearance(undefined);
  } catch {
    return resolveAppearance(undefined);
  }
}

export function fontFamily(font: TimerFont): string | undefined {
  return TIMER_FONTS.find((option) => option.value === font)?.family;
}

export function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

export function createSpeedMap(appearance: AppearanceSettings) {
  return Object.fromEntries((Object.keys(METRICS) as WidgetName[]).map((name) => [
    METRICS[name].unit,
    { buckets: [...METRICS[name].buckets], colors: appearance.palettes[name].map(hexToRgb) },
  ])) as Record<typeof METRICS[WidgetName]['unit'], { buckets: number[]; colors: number[][] }>;
}