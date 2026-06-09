import { Button } from '@/components/ui/button';

export function Card({ value, selected, disabled, onClick }: {
  value: string | number; selected: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <Button
      variant={selected ? 'default' : 'outline'}
      disabled={disabled}
      onClick={onClick}
      className="h-20 w-14 text-lg"
      aria-pressed={selected}
    >
      {value}
    </Button>
  );
}
