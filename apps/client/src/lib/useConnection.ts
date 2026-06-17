import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';

// Tracks socket connection state for the offline banner + input lock, but with a grace
// period: a normal page-load connect (~100ms) or a momentary blip shouldn't flash the red
// bar. We only report "down" after the socket has been continuously disconnected for graceMs.
export function useSocketDown(graceMs = 750): boolean {
  const [down, setDown] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const markDown = () => { if (!timer) timer = setTimeout(() => { timer = null; setDown(true); }, graceMs); };
    const markUp = () => { if (timer) { clearTimeout(timer); timer = null; } setDown(false); };
    if (socket.connected) markUp(); else markDown();
    socket.on('connect', markUp);
    socket.on('disconnect', markDown);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off('connect', markUp);
      socket.off('disconnect', markDown);
    };
  }, [graceMs]);
  return down;
}
