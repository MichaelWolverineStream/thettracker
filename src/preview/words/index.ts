import type { TimerLanguage } from '../appearance';
import { emoji } from './emoji';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ko } from './ko';
import { la } from './la';
import { mrt } from './mrt';
import { qya } from './qya';
import { ru } from './ru';
import { sv } from './sv';
import { tlh } from './tlh';

// Each format expects at least one non-zero unit; formatWords handles zero.
export const WORDS: Record<TimerLanguage, typeof en> = { en, fr, sv, es, ko, la, ru, tlh, qya, emoji, mrt };
