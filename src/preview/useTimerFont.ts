import { useEffect, useState, type RefObject } from 'react';
import { fontFamily, isCustomFontId, type AppearanceSettings } from './appearance';
import { fontErrorMessage, loadCustomFont } from './customFonts';

interface LoadedFont {
  id: string;
  family?: string;
  name?: string;
  error?: string;
}

export function useTimerFont(timer: AppearanceSettings['timer']) {
  const id = timer.font === 'custom' && isCustomFontId(timer.customFontId) ? timer.customFontId : undefined;
  const [loaded, setLoaded] = useState<LoadedFont>();
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let registered: FontFace | undefined;
    loadCustomFont(id).then(({ face, name }) => {
      if (cancelled) return;
      document.fonts.add(face);
      registered = face;
      setLoaded({ id, family: `"${face.family}"`, name });
    }).catch((error: unknown) => {
      if (!cancelled) setLoaded({ id, error: fontErrorMessage(error) });
    });
    return () => {
      cancelled = true;
      setLoaded(undefined);
      if (registered) document.fonts.delete(registered);
    };
  }, [id]);
  if (!id) return { family: fontFamily(timer.font), loading: false, name: undefined, error: undefined };
  return loaded?.id === id
    ? { ...loaded, loading: false }
    : { family: undefined, loading: true, name: undefined, error: undefined };
}

export function useFittedTimer(ref: RefObject<HTMLElement>, fitKey: string | undefined, text: string, baseSize: number) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !fitKey) return;
    const range = document.createRange();
    if (typeof range.getBoundingClientRect !== 'function') return;
    const content = element.querySelector<HTMLElement>('.timer-face-roman') ?? element;
    const fit = () => {
      element.style.fontSize = `${baseSize}px`;
      range.selectNodeContents(content);
      const width = range.getBoundingClientRect().width;
      const available = content.clientWidth;
      if (width > available && available > 0) element.style.fontSize = `${baseSize * available / width * 0.99}px`;
      // Font metrics (including optical sizing) do not always scale linearly.
      if (content !== element && range.getBoundingClientRect().width > available && available > 0) {
        let low = 0;
        let high = Number.parseFloat(element.style.fontSize);
        for (let step = 0; step < 10; step++) {
          const size = (low + high) / 2;
          element.style.fontSize = `${size}px`;
          if (range.getBoundingClientRect().width <= available * 0.99) low = size;
          else high = size;
        }
        element.style.fontSize = `${low}px`;
      }
    };
    fit();
    document.fonts?.addEventListener('loadingdone', fit);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
    observer?.observe(element);
    window.addEventListener('resize', fit);
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener('loadingdone', fit);
      window.removeEventListener('resize', fit);
      element.style.fontSize = '';
    };
  }, [ref, fitKey, text, baseSize]);
}