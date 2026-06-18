import { cn } from '@/lib/utils';

export function Card({ value, selected, disabled, onClick }: {
  value: string | number; selected: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Vote ${value}`}
      className={cn(
        'relative grid aspect-[5/7] w-20 place-items-center rounded-xl border-2 bg-card text-card-foreground shadow-sm transition-transform duration-200 ease-out sm:w-24',
        'hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'motion-safe:active:scale-95',
        'disabled:pointer-events-none disabled:opacity-45',
        selected
          ? 'border-primary bg-primary text-primary-foreground shadow-md'
          : 'border-border hover:border-primary/50 active:border-primary',
      )}
    >
      <span aria-hidden className="absolute left-2 top-1.5 text-xs font-semibold opacity-60">{value}</span>
      <span className="text-3xl font-bold tabular-nums sm:text-4xl">{value}</span>
      <span aria-hidden className="absolute right-2 bottom-1.5 rotate-180 text-xs font-semibold opacity-60">{value}</span>
    </button>
  );
}
