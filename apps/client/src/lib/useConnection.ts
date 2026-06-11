import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';

// Tracks live socket connection state. socket.io auto-reconnects, so we only
// need to mirror connect/disconnect into React for the offline banner + lock.
export function useConnection(): boolean {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    socket.on('connect', up);
    socket.on('disconnect', down);
    return () => {
      socket.off('connect', up);
      socket.off('disconnect', down);
    };
  }, []);
  return connected;
}
