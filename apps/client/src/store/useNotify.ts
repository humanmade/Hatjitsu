import { create } from 'zustand';

const KEY = 'hmpp:notify';

// Enabled only when the user opted in AND the browser still grants permission.
function initial(): boolean {
  try {
    return (
      localStorage.getItem(KEY) === '1' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    );
  } catch {
    return false;
  }
}

interface NotifyStore {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}
export const useNotify = create<NotifyStore>((set) => ({
  enabled: initial(),
  setEnabled: (v) => {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ }
    set({ enabled: v });
  },
}));
