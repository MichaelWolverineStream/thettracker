import type { DurationParts } from '../timerFormat';
import { en } from './en';

export const mrt = {
  notStarted: "I pity the fool who ain't started!",
  format: (parts: DurationParts) => `${en.format(parts)}, fool!`,
};
