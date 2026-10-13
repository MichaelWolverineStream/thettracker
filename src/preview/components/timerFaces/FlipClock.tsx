export default function FlipClock({ clock }: { clock: string }) {
  return (
    <span className="timer-face-flip">
      {[...clock].map((char, index) => char === ':' ? (
        <span key={index} className="timer-flip-colon">:</span>
      ) : (
        <span key={index} className="timer-flip-card">
          <span key={char} className="timer-flip-digit">{char}</span>
        </span>
      ))}
    </span>
  );
}
