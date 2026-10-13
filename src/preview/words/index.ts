import type { TimerLanguage } from '../appearance';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ko } from './ko';
import { la } from './la';
import { sv } from './sv';

// Each format expects at least one non-zero unit; formatWords handles zero.
export const WORDS: Record<TimerLanguage, typeof en> = { en, fr, sv, es, ko, la };
