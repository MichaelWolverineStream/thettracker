import { TRACKER_API_VERSION } from '../versionRouting';
import { parseAppearance, resolveAppearance, type AppearanceSettings } from './appearance';

export const WIDGETS = [
  { name: 'checkCount', label: 'Checks (checks per hour)' },
  { name: 'bonks', label: 'Bonks (milliBonks per minute)' },
  { name: 'chestTurns', label: 'Chest Turns (chest turns per hour)' },
  { name: 'deaths', label: 'Deaths (megadeaths per millenia)' },
  { name: 'rupees', label: 'Rupees (rupees spent per hour)' },
  { name: 'screens', label: 'Screen Transitions (screens per hour)' },
  { name: 'damage', label: 'Damage Taken (hearts spent per hour)' },
  { name: 'magic', label: 'Magic Used (magic bars per hour)' },
] as const;

export type WidgetName = typeof WIDGETS[number]['name'];
export type WidgetSettings = Record<WidgetName, boolean>;
export type TrackerSettings = WidgetSettings & { boxes: string; appearance: AppearanceSettings };

export const DEFAULT_LAUNCH_SETTINGS: Readonly<WidgetSettings> = Object.freeze(
  Object.fromEntries(WIDGETS.map(({ name }) => [name, true])) as WidgetSettings,
);

export function determineBoxCount(settings: WidgetSettings): string {
  const count = WIDGETS.filter(({ name }) => settings[name]).length;
  return String([1, 1, 2, 3, 4, 3, 3, 4, 4][count]);
}

export function parsePreviewSettings(search: string): TrackerSettings {
  const params = new URLSearchParams(search);
  return {
    ...Object.fromEntries(WIDGETS.map(({ name }) => [name, params.get(name) === 'true'])) as WidgetSettings,
    boxes: params.get('boxes') ?? '3',
    appearance: parseAppearance(params.get('appearance')),
  };
}

export function buildPreviewUrl(settings: WidgetSettings & { boxes: string; appearance?: AppearanceSettings }): string {
  const params = new URLSearchParams({ tracker: 'true', version: TRACKER_API_VERSION });
  for (const { name } of WIDGETS) params.set(name, String(settings[name]));
  params.set('boxes', settings.boxes);
  params.set('appearance', JSON.stringify({ v: 1, ...resolveAppearance(settings.appearance) }));
  return `./index.html?${params.toString()}`;
}