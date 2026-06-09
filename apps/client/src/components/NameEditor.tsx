import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { socket } from '@/lib/socket';

export function NameEditor({ slug, currentName }: { slug: string; currentName: string }) {
  const [value, setValue] = useState(currentName);
  return (
    <Input
      className="w-44" value={value} onChange={(e) => setValue(e.target.value)}
      onBlur={() => value && value !== currentName && socket.emit('name:set', { slug, name: value }, (res) => { if ('error' in res) toast.error(res.error); })}
      aria-label="Your name"
    />
  );
}
