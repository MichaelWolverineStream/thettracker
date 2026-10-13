const BITS = [8, 4, 2, 1];
// Tens columns only need enough bits for 2 (hours) and 5 (minutes, seconds).
const COLUMN_BITS = [2, 4, 3, 4, 3, 4];
const UNLIT = 0.15;

export default function BinaryClock({ clock, height }: { clock: string; height: number }) {
  const digits = clock.replace(/:/g, '').split('').map(Number);
  return (
    <svg className="timer-face timer-face-binary" role="img" aria-label={clock} viewBox="0 0 86 48" width={height * 86 / 48} height={height} fill="currentColor">
      {digits.map((digit, column) => {
        const cx = 6 + column * 12 + Math.floor(column / 2) * 7;
        return (
          <g key={column} data-digit={digit}>
            {BITS.map((bit, row) => row >= BITS.length - COLUMN_BITS[column] && (
              <circle key={bit} data-bit={bit} cx={cx} cy={6 + row * 12} r="4.5" opacity={digit & bit ? 1 : UNLIT} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
