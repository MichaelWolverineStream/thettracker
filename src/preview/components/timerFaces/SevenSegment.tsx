const WIDTH = 12;
const HEIGHT = 22;
const THICKNESS = 2.4;
const GAP = 0.5;
const UNLIT = 0.12;

const LEFT = THICKNESS / 2;
const RIGHT = WIDTH - THICKNESS / 2;
const TOP = THICKNESS / 2;
const MIDDLE = HEIGHT / 2;
const BOTTOM = HEIGHT - THICKNESS / 2;

const LINES = {
  a: [LEFT, TOP, RIGHT, TOP],
  b: [RIGHT, TOP, RIGHT, MIDDLE],
  c: [RIGHT, MIDDLE, RIGHT, BOTTOM],
  d: [LEFT, BOTTOM, RIGHT, BOTTOM],
  e: [LEFT, MIDDLE, LEFT, BOTTOM],
  f: [LEFT, TOP, LEFT, MIDDLE],
  g: [LEFT, MIDDLE, RIGHT, MIDDLE],
} as const;

const DIGITS: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

function hexagon([x1, y1, x2, y2]: readonly number[]): string {
  const half = THICKNESS / 2;
  if (y1 === y2) {
    const start = x1 + GAP;
    const end = x2 - GAP;
    return `${start},${y1} ${start + half},${y1 - half} ${end - half},${y1 - half} ${end},${y1} ${end - half},${y1 + half} ${start + half},${y1 + half}`;
  }
  const start = y1 + GAP;
  const end = y2 - GAP;
  return `${x1},${start} ${x1 + half},${start + half} ${x1 + half},${end - half} ${x1},${end} ${x1 - half},${end - half} ${x1 - half},${start + half}`;
}

const SEGMENTS = Object.entries(LINES).map(([name, line]) => ({ name, points: hexagon(line) }));

export default function SevenSegment({ clock, height }: { clock: string; height: number }) {
  let x = 4;
  const cells = [...clock].map((char) => {
    const left = x;
    x += char === ':' ? 6 : WIDTH + 3;
    return { char, left };
  });
  const width = x - 2;
  return (
    <svg className="timer-face timer-face-lcd" role="img" aria-label={clock} viewBox={`0 0 ${width} 24`} width={height * width / 24} height={height}>
      <g transform="translate(0 1) skewX(-6)" fill="currentColor">
        {cells.map(({ char, left }, index) => char === ':' ? (
          <g key={index} transform={`translate(${left} 0)`}>
            <circle cx="1.5" cy={HEIGHT * 0.3} r="1.4" />
            <circle cx="1.5" cy={HEIGHT * 0.7} r="1.4" />
          </g>
        ) : (
          <g key={index} data-digit={char} transform={`translate(${left} 0)`}>
            {SEGMENTS.map(({ name, points }) => <polygon key={name} data-segment={name} points={points} opacity={DIGITS[char].includes(name) ? 1 : UNLIT} />)}
          </g>
        ))}
      </g>
    </svg>
  );
}
