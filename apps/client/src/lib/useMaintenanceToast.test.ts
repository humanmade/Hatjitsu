import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const toast = vi.fn();
const dismiss = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign((...a: unknown[]) => toast(...a), { dismiss: (...a: unknown[]) => dismiss(...a) }),
}));

import { useMaintenanceToast } from './useMaintenanceToast';

function fakeSocket() {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    on: (e: string, cb: () => void) => { (handlers[e] ||= []).push(cb); },
    off: (e: string, cb: () => void) => { handlers[e] = (handlers[e] || []).filter((h) => h !== cb); },
    fire: (e: string) => (handlers[e] || []).forEach((h) => h()),
  };
}

beforeEach(() => { toast.mockClear(); dismiss.mockClear(); });

describe('useMaintenanceToast', () => {
  it('shows a "back soon" notice that stays put until reconnect', () => {
    const socket = fakeSocket();
    renderHook(() => useMaintenanceToast(socket));
    socket.fire('server:maintenance');
    expect(toast).toHaveBeenCalledTimes(1);
    const [msg, opts] = toast.mock.calls[0] as [unknown, { duration?: number }];
    expect(String(msg)).toContain('back soon');
    expect(opts.duration).toBe(Infinity); // no auto-dismiss while we're down
  });

  it('dismisses the notice once the socket reconnects', () => {
    const socket = fakeSocket();
    renderHook(() => useMaintenanceToast(socket));
    socket.fire('server:maintenance');
    socket.fire('connect');
    expect(dismiss).toHaveBeenCalled();
  });

  it('unsubscribes from both events on unmount', () => {
    const socket = fakeSocket();
    const { unmount } = renderHook(() => useMaintenanceToast(socket));
    unmount();
    socket.fire('server:maintenance');
    socket.fire('connect');
    expect(toast).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
