import { useCallback, useEffect, useState } from 'react';
import type { RoomStatus } from '@hmpp/shared';
import { socket } from '@/lib/socket';
import { getSessionId, getRecentRooms, forgetRoom, clearRecentRooms } from '@/lib/session';
import { mergeRecent, type RecentRoomView } from '@/lib/recentRooms';

/** Reads the remembered rooms, fetches their live standing once, and exposes a merged view
 * plus forget/clear handlers. Fires a single rooms:status on mount (and on (re)connect). */
export function useRecentRooms(): {
  rooms: RecentRoomView[];
  forget: (slug: string) => void;
  clearAll: () => void;
} {
  const [recent, setRecent] = useState(() => getRecentRooms());
  const [statuses, setStatuses] = useState<RoomStatus[]>([]);

  useEffect(() => {
    const slugs = recent.map((r) => r.slug);
    if (slugs.length === 0) return;
    const fetchStatus = () => {
      socket.emit('rooms:status', { sessionId: getSessionId(), slugs }, (res) => {
        if (Array.isArray(res)) setStatuses(res);
      });
    };
    // Refresh on (re)connect, when the lobby tab regains focus (you voted elsewhere and came
    // back), and on a gentle interval while the tab is visible — the lobby is transient, so
    // this is cheap and keeps standing current without a live subscription.
    const refreshIfVisible = () => { if (document.visibilityState === 'visible') fetchStatus(); };
    if (socket.connected) fetchStatus();
    socket.on('connect', fetchStatus);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    const poll = setInterval(refreshIfVisible, 15000);
    return () => {
      socket.off('connect', fetchStatus);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      clearInterval(poll);
    };
    // recent is captured once on mount; forget/clear update it directly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forget = useCallback((slug: string) => {
    forgetRoom(slug);
    setRecent((rs) => rs.filter((r) => r.slug !== slug));
  }, []);

  const clearAll = useCallback(() => {
    clearRecentRooms();
    setRecent([]);
  }, []);

  return { rooms: mergeRecent(recent, statuses), forget, clearAll };
}
