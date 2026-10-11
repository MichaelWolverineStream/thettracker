import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { ArrowUpRight, ChevronDown, Palette, RotateCcw, Save, Upload } from 'lucide-react';
import { WIDGETS, buildPreviewUrl, determineBoxCount, type WidgetName } from '../preview/config';
import { LARGE_CHECK_BUCKETS, METRICS, TIMER_FONTS, normalizeColor, type TimerFont } from '../preview/appearance';
import { fontErrorMessage, importCustomFont } from '../preview/customFonts';
import { useFittedTimer, useTimerFont } from '../preview/useTimerFont';
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
  const [customFont, setCustomFont] = useState<{ id: string; name: string } | undefined>(() => draft.appearance.timer.customFontId ? { id: draft.appearance.timer.customFontId, name: 'Custom font' } : undefined);
  const [importing, setImporting] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const uploadSequence = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const sample = useRef<HTMLDivElement>(null);
  const font = useTimerFont(draft.appearance.timer);
  const customFamily = draft.appearance.timer.font === 'custom' ? font.family : undefined;
  useFittedTimer(sample, customFamily, '00:00:00', 30);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => () => { uploadSequence.current += 1; }, []);
  useEffect(() => {
    if (font.name && draft.appearance.timer.customFontId) setCustomFont({ id: draft.appearance.timer.customFontId, name: font.name });
  }, [font.name, draft.appearance.timer.customFontId]);

  function edit(update: SetStateAction<PreviewDefaults>) {
    setDraft(update);
    setFeedback(null);
  }

  function launch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (importing) return;
    window.open(buildPreviewUrl({ ...draft.widgets, boxes: determineBoxCount(draft.widgets), appearance: draft.appearance }), '_blank', WINDOW_FEATURES);
  }

  function save() {
    if (importing) return;
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

  function changeFont(value: TimerFont) {
    uploadSequence.current += 1;
    setImporting(false);
    setUploadError(undefined);
    edit((previous) => ({ ...previous, appearance: { ...previous.appearance, timer: { color: previous.appearance.timer.color, font: value, ...(value === 'custom' && customFont ? { customFontId: customFont.id } : {}) } } }));
  }

  function reset() {
    uploadSequence.current += 1;
    setImporting(false);
    setUploadError(undefined);
    setCustomFont(undefined);
    edit(factoryPreviewDefaults);
  }

  async function upload(file: File) {
    const sequence = ++uploadSequence.current;
    setImporting(true);
    setUploadError(undefined);
    try {
      const asset = await importCustomFont(file);
      if (sequence !== uploadSequence.current) return;
      setCustomFont({ id: asset.id, name: asset.name });
      edit((previous) => ({ ...previous, appearance: { ...previous.appearance, timer: { color: previous.appearance.timer.color, font: 'custom', customFontId: asset.id } } }));
    } catch (error) {
      if (sequence === uploadSequence.current) setUploadError(fontErrorMessage(error));
    } finally {
      if (sequence === uploadSequence.current) setImporting(false);
    }
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
              <div className={styles.fontControls}>
                <select id="preview-timer-font" value={draft.appearance.timer.font} onChange={(event) => changeFont(event.target.value as TimerFont)}>
                  {TIMER_FONTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  {customFont && <option value="custom">Custom: {customFont.name}</option>}
                </select>
                <button type="button" className={styles.iconButton} aria-label="Upload timer font" title="Upload timer font" disabled={importing} onClick={() => fileInput.current?.click()}><Upload size={18} aria-hidden="true" /></button>
                <input ref={fileInput} aria-label="Custom font file" type="file" accept=".woff2,.woff,.ttf,.otf" hidden onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void upload(file);
                }} />
              </div>
              {customFont && <span className={styles.fontName} title={customFont.name}>{customFont.name}</span>}
            </div>
            <div ref={sample} aria-label="Timer preview" className={styles.timerSample} style={{ color: draft.appearance.timer.color, fontFamily: font.family, ...(customFamily ? { lineHeight: '45px', minHeight: '45px' } : {}) }}>00:00:00</div>
            <span aria-label="Font status" aria-live="polite" className={`${styles.fontStatus} ${uploadError || font.error ? styles.error : styles.status}`}>{importing ? 'Importing font' : uploadError ?? (font.loading ? 'Loading font' : font.error ?? '')}</span>
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
          <button type="submit" className={styles.launch} disabled={importing}><ArrowUpRight size={18} aria-hidden="true" />Launch</button>
          <button type="button" className={styles.launch} disabled={importing} onClick={save}><Save size={18} aria-hidden="true" />Save Defaults</button>
          <button type="button" className={styles.launch} onClick={reset}><RotateCcw size={18} aria-hidden="true" />Reset</button>
          <span role="status" aria-label="Defaults status" className={feedback === 'error' ? styles.error : styles.status}>{feedback === 'error' ? 'Save failed' : dirty ? 'Unsaved' : feedback === 'saved' ? 'Saved' : ''}</span>
        </div>
      </form>
    </section>
  );
}