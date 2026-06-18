import { useEffect } from 'react';
import { toast } from 'sonner';

const TOAST_ID = 'server-maintenance';

type MaintenanceSocket = {
  on(ev: 'server:maintenance' | 'connect', cb: () => void): void;
  off(ev: 'server:maintenance' | 'connect', cb: () => void): void;
};

/** Surfaces the server's shutdown notice as a toast so people expect a brief reconnect (handled
 * by Socket.IO + the ConnectionStatus banner) rather than reading the drop as a failure. The
 * notice stays put (no auto-dismiss) until we're actually back, then clears on reconnect. */
export function useMaintenanceToast(socket: MaintenanceSocket) {
  useEffect(() => {
    const onMaintenance = () =>
      toast('We’re restarting for maintenance — we’ll be back soon.', {
        id: TOAST_ID,
        duration: Infinity,
      });
    const onReconnect = () => toast.dismiss(TOAST_ID);
    socket.on('server:maintenance', onMaintenance);
    socket.on('connect', onReconnect);
    return () => {
      socket.off('server:maintenance', onMaintenance);
      socket.off('connect', onReconnect);
    };
  }, [socket]);
}
