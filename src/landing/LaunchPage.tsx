import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { DEFAULT_LAUNCH_SETTINGS, WIDGETS, buildPreviewUrl, determineBoxCount, type WidgetSettings } from '../preview/config';
import { DEFAULT_LEGACY_SETTINGS, LEGACY_WIDGETS, WINDOW_FEATURES, buildLegacyUrl } from './legacyLaunch';
import styles from './launchpage.module.css';

function VersionSection({ preview }: { preview: boolean }) {
  const version = preview ? 'v0.1.0-preview' : 'v0.0.43-legacy';
  const widgets = preview ? WIDGETS : LEGACY_WIDGETS;
  const [settings, setSettings] = useState<WidgetSettings>({
    ...(preview ? DEFAULT_LAUNCH_SETTINGS : DEFAULT_LEGACY_SETTINGS),
  });

  function launch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = preview
      ? buildPreviewUrl({ ...settings, boxes: determineBoxCount(settings) })
      : buildLegacyUrl(settings);
    window.open(url, '_blank', WINDOW_FEATURES);
  }

  return (
    <section className={styles.section} aria-labelledby={`${version}-heading`}>
      <header className={styles.versionHeader}>
        <h2 id={`${version}-heading`}>{version}</h2>
        <span className={preview ? styles.previewBadge : styles.legacyBadge}>
          {preview ? 'Preview' : 'Legacy'}
        </span>
      </header>
      <form onSubmit={launch}>
        <div className={styles.widgets}>
          {widgets.map(({ name, label }) => (
            <label key={name} htmlFor={`${version}-${name}`} className={styles.widget}>
              <input
                id={`${version}-${name}`}
                name={name}
                type="checkbox"
                checked={settings[name]}
                onChange={(event) => setSettings((previous) => ({ ...previous, [name]: event.target.checked }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <button type="submit" className={styles.launch}>
          <ArrowUpRight size={18} aria-hidden="true" />
          Launch
        </button>
      </form>
    </section>
  );
}

export default function LaunchPage() {
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Auto Stats</h1>
        <p>by StructuralMike</p>
      </header>
      <VersionSection preview />
      <VersionSection preview={false} />
    </main>
  );
}