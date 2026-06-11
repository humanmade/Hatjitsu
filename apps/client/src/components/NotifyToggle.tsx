import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useNotify } from '@/store/useNotify';

// Header bell. Enabling requests browser permission on the user's click (required
// gesture); firing happens in useRoomNotifications when the tab is unfocused.
export function NotifyToggle() {
  const { enabled, setEnabled } = useNotify();
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  if (!supported) return null;

  const toggle = async () => {
    if (enabled) { setEnabled(false); return; }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm === 'granted') setEnabled(true);
    else toast.error('Notifications are blocked in your browser settings.');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Disable round notifications' : 'Enable round notifications'}
      title={enabled ? 'Round notifications on' : 'Round notifications off'}
    >
      {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
    </Button>
  );
}
