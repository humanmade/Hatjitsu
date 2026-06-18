import { useEffect } from 'react';
import { toast } from 'sonner';

type MaintenanceSocket = {
  on(ev: 'server:maintenance', cb: () => void): void;
  off(ev: 'server:maintenance', cb: () => void): void;
};

/** Surfaces the server's shutdown notice as a toast so people expect a brief reconnect (handled
 * by Socket.IO + the ConnectionStatus banner) rather than reading the drop as a failure. */
export function useMaintenanceToast(socket: MaintenanceSocket) {
  useEffect(() => {
    const onMaintenance = () => toast('We’re restarting for maintenance — we’ll be back soon.');
    socket.on('server:maintenance', onMaintenance);
    return () => socket.off('server:maintenance', onMaintenance);
  }, [socket]);
}
