import { splitDuration } from '../../timerFormat';

export default function ProgressRings({ ms, label, size }: { ms: number; label: string; size: number }) {
  const { hours, minutes, seconds } = splitDuration(ms);
  const rings = [
    { name: 'seconds', radius: 43, fraction: seconds / 60 },
    { name: 'minutes', radius: 32, fraction: (minutes + seconds / 60) / 60 },
    { name: 'hours', radius: 21, fraction: ((hours % 12) + minutes / 60) / 12 },
  ];
  return (
    <svg className="timer-face timer-face-rings" role="img" aria-label={label} viewBox="0 0 100 100" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="8">
      {rings.map(({ name, radius, fraction }) => {
        const circumference = 2 * Math.PI * radius;
        return (
          <g key={name} data-ring={name} data-fraction={fraction}>
            <circle cx="50" cy="50" r={radius} opacity="0.15" />
            {fraction > 0 && <circle cx="50" cy="50" r={radius} strokeLinecap="round" strokeDasharray={`${fraction * circumference} ${circumference}`} transform="rotate(-90 50 50)" />}
          </g>
        );
      })}
    </svg>
  );
}
