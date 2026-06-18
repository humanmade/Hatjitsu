import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useTheme } from './ThemeProvider';
import type { ThemeChoice } from './resolveTheme';

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'auto', label: 'Auto', Icon: Monitor },
];

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  const Current = OPTIONS.find((o) => o.value === choice)?.Icon ?? Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Theme" />}>
        <Current className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setChoice(value)} className="gap-2">
            <Icon className="size-4" />
            <span>{label}</span>
            {choice === value && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
