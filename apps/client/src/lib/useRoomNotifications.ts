import { useEffect, useRef } from 'react';
import { useNotify } from '@/store/useNotify';
import type { PublicRoom } from '@hmpp/shared';

function fire(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch { /* ignore */ }
}

// Watches room state for reveal (false->true) and new-round (true->false) transitions
// and fires a desktop notification for each — but only while the tab is unfocused.
export function useRoomNotifications(room: PublicRoom | null) {
  const enabled = useNotify((s) => s.enabled);
  const prevRevealed = useRef<boolean | null>(null);

  useEffect(() => {
    if (!room) { prevRevealed.current = null; return; }
    const before = prevRevealed.current;
    prevRevealed.current = room.revealed;

    if (before === null) return; // first observation — no transition to report
    if (before === room.revealed) return; // unrelated update
    if (!enabled) return;
    if (typeof document !== 'undefined' && !document.hidden) return; // silent when focused

    const label = room.roundLabel ? ` for ${room.roundLabel}` : '';
    if (room.revealed) fire(`Results in${label}`, 'Votes have been revealed.');
    else fire('New round started', room.roundLabel ? `Round: ${room.roundLabel}` : 'Cast your vote.');
  }, [room, enabled]);
}
