import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTheme } from './ThemeProvider';
import type { ThemeChoice } from './resolveTheme';

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
];

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <ToggleGroup
      value={[choice]}
      onValueChange={(v: string[]) => {
        if (v[0]) setChoice(v[0] as ThemeChoice);
      }}
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, label }) => (
        <ToggleGroupItem key={value} value={value}>
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
