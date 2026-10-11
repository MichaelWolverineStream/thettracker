import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { ArrowUpRight, ChevronDown, Palette, RotateCcw, Save } from 'lucide-react';
import { WIDGETS, buildPreviewUrl, determineBoxCount, type WidgetName } from '../preview/config';
import { LARGE_CHECK_BUCKETS, METRICS, TIMER_FONTS, fontFamily, normalizeColor, type TimerFont } from '../preview/appearance';
import { factoryPreviewDefaults, loadPreviewDefaults, savePreviewDefaults, type PreviewDefaults } from './previewDefaults';
import { WINDOW_FEATURES } from './legacyLaunch';
import styles from './launchpage.module.css';

function ColorStop({ label, color, change, threshold }: { label: string; color: string; change: Dispatch<string>; threshold?: string }) {
  return (
    <label className={styles.colorStop}>
      <span className={threshold ? styles.stopLabel : undefined}>{threshold ?? label}</span>
      <input aria-label={label} type="color" value={color} onChange={(event) => change(normalizeColor(event.target.value)!)} />
      <code>{color}</code>
    </label>
  );
}

export default function PreviewSettings() {
  const [draft, setDraft] = useState(loadPreviewDefaults);
  const [saved, setSaved] = useState(draft);
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<WidgetName, boolean>>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function edit(update: SetStateAction<PreviewDefaults>) {
    setDraft(update);
    setFeedback(null);
  }

  function launch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.open(buildPreviewUrl({ ...draft.widgets, boxes: determineBoxCount(draft.widgets), appearance: draft.appearance }), '_blank', WINDOW_FEATURES);
  }

  function save() {
    if (savePreviewDefaults(draft)) {
      setSaved(draft);
      setFeedback('saved');
    } else {
      setFeedback('error');
    }
  }

  function changePalette(name: WidgetName, colors: readonly string[]) {
    edit((previous) => ({ ...previous, appearance: { ...previous.appearance, palettes: { ...previous.appearance.palettes, [name]: colors } } }));
  }

  return (
    <section className={styles.section} aria-labelledby="v0.1.0-preview-heading">
      <header className={styles.versionHeader}>
        <h2 id="v0.1.0-preview-heading">v0.1.0-preview</h2>
        <span className={styles.previewBadge}>Preview</span>
      </header>
      <form onSubmit={launch}>
        <fieldset className={styles.timerSettings}>
          <legend>Timer</legend>
          <div className={styles.timerControls}>
            <ColorStop label="Timer color" color={draft.appearance.timer.color} change={(color) => edit((previous) => ({ ...previous, appearance: { ...previous.appearance, timer: { ...previous.appearance.timer, color } } }))} />
            <div className={styles.fontField}>
              <label htmlFor="preview-timer-font">Timer font</label>
              <select id="preview-timer-font" value={draft.appearance.timer.font} onChange={(event) => edit((previous) => ({ ...previous, appearance: { ...previous.appearance, timer: { ...previous.appearance.timer, font: event.target.value as TimerFont } } }))}>
                {TIMER_FONTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div aria-label="Timer preview" className={styles.timerSample} style={{ color: draft.appearance.timer.color, fontFamily: fontFamily(draft.appearance.timer.font) }}>00:00:00</div>
          </div>
        </fieldset>
        <div className={styles.metrics}>
          {WIDGETS.map(({ name, label }) => {
            const metric = METRICS[name];
            const colors = draft.appearance.palettes[name];
            const first = metric.buckets[0];
            const last = metric.buckets[metric.buckets.length - 1];
            const ramp = colors.map((color, index) => `${color} ${(metric.buckets[index] - first) / (last - first) * 100}%`).join(', ');
            return (
              <div key={name} className={styles.metric}>
                <div className={styles.metricHeader}>
                  <label htmlFor={`v0.1.0-preview-${name}`} className={styles.widget}>
                    <input id={`v0.1.0-preview-${name}`} name={name} type="checkbox" checked={draft.widgets[name]} onChange={(event) => edit((previous) => ({ ...previous, widgets: { ...previous.widgets, [name]: event.target.checked } }))} />
                    <span>{label}</span>
                  </label>
                  <button type="button" className={styles.iconButton} aria-label={`${metric.title} colors`} title={`${metric.title} colors`} aria-expanded={!!expanded[name]} aria-controls={`palette-${name}`} onClick={() => setExpanded((previous) => ({ ...previous, [name]: !previous[name] }))}>
                    <Palette size={18} aria-hidden="true" />
                    <ChevronDown size={12} aria-hidden="true" className={expanded[name] ? styles.chevronOpen : undefined} />
                  </button>
                </div>
                {expanded[name] && (
                  <fieldset id={`palette-${name}`} className={styles.palette}>
                    <legend>{metric.title} colors</legend>
                    <div className={styles.paletteHeader}>
                      <div className={styles.ramp} style={{ background: `linear-gradient(to right, ${ramp})` }} aria-hidden="true" />
                      <button type="button" className={styles.iconButton} aria-label={`Reset ${metric.title} colors`} title={`Reset ${metric.title} colors`} onClick={() => changePalette(name, [...metric.colors])}><RotateCcw size={16} aria-hidden="true" /></button>
                    </div>
                    <div className={styles.stops}>
                      {colors.map((color, index) => (
                        <ColorStop key={index} label={`${metric.title} stop ${index + 1}`} color={color} threshold={`${metric.buckets[index]} ${metric.unit}${name === 'checkCount' ? ` / ${LARGE_CHECK_BUCKETS[index]} ${metric.unit} (>400)` : ''}`} change={(value) => changePalette(name, colors.map((previous, stopIndex) => stopIndex === index ? value : previous))} />
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            );
          })}
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.launch}><ArrowUpRight size={18} aria-hidden="true" />Launch</button>
          <button type="button" className={styles.launch} onClick={save}><Save size={18} aria-hidden="true" />Save Defaults</button>
          <button type="button" className={styles.launch} onClick={() => edit(factoryPreviewDefaults)}><RotateCcw size={18} aria-hidden="true" />Reset</button>
          <span role="status" aria-label="Defaults status" className={feedback === 'error' ? styles.error : styles.status}>{feedback === 'error' ? 'Save failed' : dirty ? 'Unsaved' : feedback === 'saved' ? 'Saved' : ''}</span>
        </div>
      </form>
    </section>
  );
}