const COLORS = ["#ffcb3d", "#62f6be", "#48bfff", "#ff8b99", "#ffffff"];
const PIECES = 28;

/** One-shot burst of falling confetti over its positioned parent. Hidden for reduced motion (see globals.css). */
export function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0 overflow-visible">
      {Array.from({ length: PIECES }, (_, i) => {
        // spread evenly across the width with a little jitter; deterministic so it doesn't depend on Math.random
        const left = ((i * 37) % 100) + ((i * 13) % 7) - 3;
        const drift = ((i * 53) % 80) - 40;
        const spin = ((i * 97) % 720) - 360;
        return (
          <span
            key={i}
            className="confetti-piece absolute top-0 block rounded-[2px]"
            style={
              {
                left: `${left}%`,
                width: i % 3 === 0 ? 6 : 8,
                height: i % 3 === 0 ? 10 : 6,
                background: COLORS[i % COLORS.length],
                animationDelay: `${(i % 7) * 60}ms`,
                "--x": `${drift}px`,
                "--r": `${spin}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
