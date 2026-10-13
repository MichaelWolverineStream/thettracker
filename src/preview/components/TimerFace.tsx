import type { TimerVariant } from '../appearance';
import { formatClock, timerText } from '../timerFormat';
import AnalogClock from './timerFaces/AnalogClock';
import BinaryClock from './timerFaces/BinaryClock';
import FlipClock from './timerFaces/FlipClock';
import ProgressRings from './timerFaces/ProgressRings';
import SevenSegment from './timerFaces/SevenSegment';

export default function TimerFace({ variant, ms, scale = 1 }: { variant: TimerVariant; ms: number; scale?: number }) {
  const clock = formatClock(ms);
  switch (variant) {
    case 'analog': return <AnalogClock ms={ms} label={clock} size={160 * scale} />;
    case 'rings': return <ProgressRings ms={ms} label={clock} size={160 * scale} />;
    case 'lcd': return <SevenSegment clock={clock} height={52 * scale} />;
    case 'binary': return <BinaryClock clock={clock} height={72 * scale} />;
    case 'flip': return <FlipClock clock={clock} />;
    case 'words': return <span className="timer-face-words">{timerText(variant, ms)}</span>;
    default: return <>{timerText(variant, ms)}</>;
  }
}
