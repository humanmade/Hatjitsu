import { useState } from 'react';
import { colorForSession } from '@hmpp/shared';
import { Input } from '@/components/ui/input';
import { getSessionId, getStoredName, setStoredName } from '@/lib/session';

/** Lobby identity strip: a read-only colour swatch (derived from the session id) and an
 * editable display name persisted locally to hmpp:name, used on the next join. */
export function LobbyIdentity() {
  const color = colorForSession(getSessionId());
  const [value, setValue] = useState(() => getStoredName() ?? '');
  return (
    <div className="flex items-center justify-center gap-2 text-sm opacity-80">
      <span>You'll join as</span>
      <span
        data-testid="identity-swatch"
        aria-hidden="true"
        className="inline-block size-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <Input
        className="w-44 font-medium"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { const v = value.trim(); if (v) setStoredName(v); }}
        placeholder="Your name"
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
    </div>
  );
}
