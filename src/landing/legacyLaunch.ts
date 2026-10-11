export const LEGACY_WIDGETS = [
  { name: 'checkCount', label: 'Checks (checks per hour)' },
  { name: 'bonks', label: 'Bonks (milliBonks per minute)' },
  { name: 'chestTurns', label: 'Chest Turns (chest turns per hour)' },
  { name: 'deaths', label: 'Deaths (megadeaths per millenia)' },
  { name: 'rupees', label: 'Rupees (rupees spent per hour)' },
  { name: 'screens', label: 'Screen Transitions (screens per hour)' },
  { name: 'damage', label: 'Damage Taken (hearts spent per hour)' },
  { name: 'magic', label: 'Magic Used (magic bars per hour)' },
] as const;

type LegacyWidgetName = typeof LEGACY_WIDGETS[number]['name'];
export type LegacySettings = Record<LegacyWidgetName, boolean>;

export const DEFAULT_LEGACY_SETTINGS: Readonly<LegacySettings> = Object.freeze(
  Object.fromEntries(LEGACY_WIDGETS.map(({ name }) => [name, true])) as LegacySettings,
);

export const WINDOW_FEATURES = 'width=600, height=600, menubar=no, toolbar=no, location=no, status=no, resizable=yes, scrollbars=yes';

export function buildLegacyUrl(settings: LegacySettings): string {
  const count = Object.values(settings).filter(Boolean).length;
  const boxCount = [1, 1, 2, 3, 4, 3, 3, 4, 4][count] ?? 4;
  const query = new URLSearchParams(Object.entries(settings)
    .filter(([, enabled]) => enabled)
    .map(([name, enabled]) => [name, String(enabled)])).toString();
  return `./index.html?tracker=true&${query}&boxes=${boxCount}`;
}