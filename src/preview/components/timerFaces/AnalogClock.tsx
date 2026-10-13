import { splitDuration } from '../../timerFormat';

const TICKS = Array.from({ length: 60 }, (_, index) => index);
const NUMERALS = [[12, 50, 21], [3, 79, 50], [6, 50, 79], [9, 21, 50]] as const;

export default function AnalogClock({ ms, label, size }: { ms: number; label: string; size: number }) {
  const { hours, minutes, seconds } = splitDuration(ms);
  const hands = [
    { name: 'hour', angle: (hours % 12) * 30 + minutes / 2 + seconds / 120, length: 24, width: 4, tail: 0 },
    { name: 'minute', angle: minutes * 6 + seconds / 10, length: 34, width: 2.5, tail: 0 },
    { name: 'second', angle: seconds * 6, length: 39, width: 1, tail: 8 },
  ];
  return (
    <svg className="timer-face timer-face-analog" role="img" aria-label={label} viewBox="0 0 100 100" width={size} height={size}>
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="2" />
      {TICKS.map((tick) => (
        <line key={tick} x1="50" y1="5" x2="50" y2={tick % 5 ? 8 : 11} stroke="currentColor" strokeWidth={tick % 5 ? 0.75 : 1.75} opacity={tick % 5 ? 0.6 : 1} transform={`rotate(${tick * 6} 50 50)`} />
      ))}
      {NUMERALS.map(([numeral, x, y]) => (
        <text key={numeral} x={x} y={y} fill="currentColor" fontSize="11" textAnchor="middle" dominantBaseline="central">{numeral}</text>
      ))}
      {hands.map(({ name, angle, length, width, tail }) => (
        <line key={name} data-hand={name} x1="50" y1={50 + tail} x2="50" y2={50 - length} stroke="currentColor" strokeWidth={width} strokeLinecap="round" transform={`rotate(${angle} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="2.5" fill="currentColor" />
    </svg>
  );
}
