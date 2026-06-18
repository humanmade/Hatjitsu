import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const toast = vi.fn();
vi.mock('sonner', () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { useMaintenanceToast } from './useMaintenanceToast';

function fakeSocket() {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    on: (e: string, cb: () => void) => { (handlers[e] ||= []).push(cb); },
    off: (e: string, cb: () => void) => { handlers[e] = (handlers[e] || []).filter((h) => h !== cb); },
    fire: (e: string) => (handlers[e] || []).forEach((h) => h()),
  };
}

beforeEach(() => { toast.mockClear(); });

describe('useMaintenanceToast', () => {
  it('toasts a "back soon" notice when the server announces maintenance', () => {
    const socket = fakeSocket();
    renderHook(() => useMaintenanceToast(socket));
    expect(toast).not.toHaveBeenCalled();
    socket.fire('server:maintenance');
    expect(toast).toHaveBeenCalledTimes(1);
    expect(String(toast.mock.calls[0][0])).toContain('back soon');
  });

  it('unsubscribes on unmount', () => {
    const socket = fakeSocket();
    const { unmount } = renderHook(() => useMaintenanceToast(socket));
    unmount();
    socket.fire('server:maintenance');
    expect(toast).not.toHaveBeenCalled();
  });
});
