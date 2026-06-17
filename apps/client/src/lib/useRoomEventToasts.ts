import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PublicRoom } from '@hmpp/shared';

/** Joins a list of names into "A", "A and B", or "A, B and C". */
function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Surfaces room-membership events as toasts: a new facilitator taking the seat, and voters
 * swept to observer by a reveal. Diffs successive room snapshots, skipping the first so a
 * fresh join doesn't fire spurious toasts. */
export function useRoomEventToasts(room: PublicRoom | null, sessionId: string) {
  const prevFacilitator = useRef<string | null | undefined>(undefined);
  const prevDemoted = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!room) { prevFacilitator.current = undefined; prevDemoted.current = null; return; }
    const nameOf = (sid: string) => room.connections.find((c) => c.sessionId === sid)?.name ?? 'Someone';

    // Facilitator handoff.
    const before = prevFacilitator.current;
    prevFacilitator.current = room.facilitatorSessionId;
    if (before !== undefined && room.facilitatorSessionId && room.facilitatorSessionId !== before) {
      if (room.facilitatorSessionId === sessionId) toast.success('You’re now the facilitator');
      else toast(`${nameOf(room.facilitatorSessionId)} is now facilitating`);
    }

    // Reveal sweep: people newly switched to observer for not voting.
    const demotedNow = new Set(room.connections.filter((c) => c.autoDemoted).map((c) => c.sessionId));
    const seen = prevDemoted.current;
    prevDemoted.current = demotedNow;
    if (seen) {
      const fresh = [...demotedNow].filter((sid) => !seen.has(sid) && sid !== sessionId);
      if (fresh.length > 0) {
        const names = nameList(fresh.map(nameOf));
        const verb = fresh.length === 1 ? 'was' : 'were';
        toast(`${names} ${verb} set to observer (didn’t vote this round)`);
      }
    }
  }, [room, sessionId]);
}
