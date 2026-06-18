// Decorative trio of planning-poker cards, fanned out from a shared bottom pivot (like a hand
// of cards). Purely visual (aria-hidden); mirrors the real Card look and hover lift from
// Card.tsx. The fan rotation lives on a wrapper (pivoting at bottom-centre) so it composes with
// the inner card's hover transform instead of fighting it.
// Stacked 3 over 5 over 8 (left-leaning card on top).
const FAN = [
  { value: '8', rotate: 16, z: 1 },
  { value: '5', rotate: 0, z: 2 },
  { value: '3', rotate: -16, z: 3 },
];

export function FannedCards() {
  return (
    <div aria-hidden className="relative h-36 w-[168px]">
      {FAN.map((c) => (
        <div
          key={c.value}
          className="absolute bottom-0 left-1/2"
          style={{ transformOrigin: 'bottom center', transform: `translateX(-50%) rotate(${c.rotate}deg)`, zIndex: c.z }}
        >
          <div className="group relative grid aspect-[5/7] w-24 place-items-center rounded-xl border-2 border-border bg-card text-card-foreground shadow-md transition-transform duration-200 ease-out motion-safe:hover:-translate-y-1.5 motion-safe:active:scale-95 hover:border-primary/50">
            <span className="absolute left-2 top-1.5 text-xs font-semibold opacity-60">{c.value}</span>
            <span className="text-4xl font-bold tabular-nums">{c.value}</span>
            <span className="absolute right-2 bottom-1.5 rotate-180 text-xs font-semibold opacity-60">{c.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
