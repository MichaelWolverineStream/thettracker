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
    setLoaded(undefined);
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
      if (registered) document.fonts.delete(registered);
    };
  }, [id]);
  if (!id) return { family: fontFamily(timer.font), loading: false, name: undefined, error: undefined };
  return loaded?.id === id
    ? { ...loaded, loading: false }
    : { family: undefined, loading: true, name: undefined, error: undefined };
}

export function useFittedTimer(ref: RefObject<HTMLElement>, family: string | undefined, text: string, baseSize: number) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !family) return;
    const range = document.createRange();
    if (typeof range.getBoundingClientRect !== 'function') return;
    const fit = () => {
      element.style.fontSize = `${baseSize}px`;
      range.selectNodeContents(element);
      const width = range.getBoundingClientRect().width;
      const available = element.clientWidth;
      if (width > available && available > 0) element.style.fontSize = `${baseSize * available / width * 0.99}px`;
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
    observer?.observe(element);
    window.addEventListener('resize', fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fit);
      element.style.fontSize = '';
    };
  }, [ref, family, text, baseSize]);
}