import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { socket } from '@/lib/socket';

export function NameEditor({ slug, currentName, color }: { slug: string; currentName: string; color?: string }) {
  const [value, setValue] = useState(currentName);
  useEffect(() => { setValue(currentName); }, [currentName]);
  return (
    <Input
      className="w-44 font-medium"
      style={color ? { color: `color-mix(in oklab, ${color}, var(--foreground) 40%)` } : undefined}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value && value !== currentName && socket.emit('name:set', { slug, name: value }, (res) => { if ('error' in res) toast.error(res.error); })}
      aria-label="Your name"
      // Keep password managers / browser autofill out of a display-name field.
      name="display-name"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
    />
  );
}
