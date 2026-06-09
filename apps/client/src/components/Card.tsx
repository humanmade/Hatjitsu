import { Button } from '@/components/ui/button';

export function Card({ value, selected, disabled, onClick }: {
  value: string | number; selected: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <Button
      variant={selected ? 'default' : 'outline'}
      disabled={disabled}
      onClick={onClick}
      className="h-auto w-16 aspect-[5/7] rounded-lg p-0 text-xl font-semibold"
      aria-pressed={selected}
    >
      {value}
    </Button>
  );
}
