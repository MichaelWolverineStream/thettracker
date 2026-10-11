import { DEFAULT_LAUNCH_SETTINGS, WIDGETS, type WidgetSettings } from '../preview/config';
import { isRecord, resolveAppearance, type AppearanceSettings } from '../preview/appearance';

export const PREVIEW_DEFAULTS_KEY = 'thettracker:launcher:0.1.0-preview:defaults:v1';
export const MAX_DEFAULTS_LENGTH = 4096;

export interface PreviewDefaults {
  widgets: WidgetSettings;
  appearance: AppearanceSettings;
}

export function factoryPreviewDefaults(): PreviewDefaults {
  return { widgets: { ...DEFAULT_LAUNCH_SETTINGS }, appearance: resolveAppearance(undefined) };
}

function resolveDefaults(value: Record<string, unknown>): PreviewDefaults {
  const settings = factoryPreviewDefaults();
  const widgets = isRecord(value.widgets) ? value.widgets : {};
  for (const { name } of WIDGETS) {
    const enabled = widgets[name];
    if (typeof enabled === 'boolean') settings.widgets[name] = enabled;
  }
  settings.appearance = resolveAppearance(value.appearance);
  return settings;
}

export function loadPreviewDefaults(): PreviewDefaults {
  try {
    const raw = window.localStorage.getItem(PREVIEW_DEFAULTS_KEY);
    if (!raw || raw.length > MAX_DEFAULTS_LENGTH) return factoryPreviewDefaults();
    const value: unknown = JSON.parse(raw);
    return isRecord(value) && value.v === 1 ? resolveDefaults(value) : factoryPreviewDefaults();
  } catch {
    return factoryPreviewDefaults();
  }
}

export function savePreviewDefaults(settings: PreviewDefaults): boolean {
  try {
    const validated = resolveDefaults({ widgets: settings.widgets, appearance: settings.appearance });
    window.localStorage.setItem(PREVIEW_DEFAULTS_KEY, JSON.stringify({ v: 1, ...validated }));
    return true;
  } catch {
    return false;
  }
}