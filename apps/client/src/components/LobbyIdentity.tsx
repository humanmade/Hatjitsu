import { useState } from 'react';
import { colorForSession } from '@hmpp/shared';
import { Input } from '@/components/ui/input';
import { getSessionId, getStoredName, setStoredName } from '@/lib/session';

/** Lobby greeting: "Hello, [name]" where the editable name renders in the user's own colour
 * (the same deterministic colour they appear as in rooms). The input matches the room's
 * NameEditor exactly. Persists locally to hmpp:name, used on the next join. */
export function LobbyIdentity() {
  const color = colorForSession(getSessionId());
  const [value, setValue] = useState(() => getStoredName() ?? '');
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-2xl font-bold">
      <span>Hello,</span>
      <Input
        className="w-44 font-medium"
        style={{ color: `color-mix(in oklab, ${color}, var(--foreground) 40%)` }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { const v = value.trim(); if (v) setStoredName(v); }}
        placeholder="your name"
        aria-label="Your name"
        name="display-name"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
      />
    </p>
  );
}
