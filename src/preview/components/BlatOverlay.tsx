import { useEffect, useState } from 'react';

function place() {
  return { left: Math.random() * 100, top: Math.random() * 100, angle: Math.random() * 360 };
}

export default function BlatOverlay({ size, color }: { size: number; color?: string }) {
  const [position, setPosition] = useState(place);

  useEffect(() => {
    const interval = setInterval(() => setPosition(place()), 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <span aria-hidden="true" className="timer-blat" style={{
      left: `${position.left}%`,
      top: `${position.top}%`,
      transform: `translate(-50%, -50%) rotate(${position.angle}deg)`,
      fontSize: size,
      color,
    }}>BLAT!!!</span>
  );
}
