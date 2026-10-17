import { useEffect, useState } from 'react';

// Side of the square (in em) that fully contains "BLAT!!!" at any rotation.
const BLAT_SQUARE_EM = 3.2;
const MAX_ANGLE = 80;

function place() {
  return { x: Math.random(), y: Math.random(), angle: Math.random() * MAX_ANGLE * 2 - MAX_ANGLE };
}

function axis(ratio: number, square: number) {
  return `calc(${square / 2}px + ${ratio} * (100% - ${square}px))`;
}

export default function BlatOverlay({ size, color }: { size: number; color?: string }) {
  const [position, setPosition] = useState(place);
  const square = size * BLAT_SQUARE_EM;

  useEffect(() => {
    const interval = setInterval(() => setPosition(place()), 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <span aria-hidden="true" className="timer-blat" style={{
      left: axis(position.x, square),
      top: axis(position.y, square),
      transform: `translate(-50%, -50%) rotate(${position.angle}deg)`,
      fontSize: size,
      color,
    }}>BLAT!!!</span>
  );
}
