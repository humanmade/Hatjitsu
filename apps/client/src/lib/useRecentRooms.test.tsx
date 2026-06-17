import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the socket so the hook's emit is observable and we control the response.
const handlers: Record<string, (...a: never[]) => void> = {};
vi.mock('@/lib/socket', () => ({
  socket: {
    connected: true,
    emit: (event: string, ...args: unknown[]) => {
      const cb = args[args.length - 1] as (res: unknown) => void;
      if (event === 'rooms:status') {
        const { slugs } = args[0] as { slugs: string[] };
        cb(slugs.map((slug) => ({ slug, active: false })));
      }
    },
    on: (e: string, h: (...a: never[]) => void) => { handlers[e] = h; },
    off: () => {},
  },
}));

import { useRecentRooms } from './useRecentRooms';
import { rememberRoom } from './session';

beforeEach(() => { localStorage.clear(); });

describe('useRecentRooms', () => {
  it('requests status for remembered slugs and exposes the merged view', async () => {
    rememberRoom('a'); rememberRoom('b');
    const { result } = renderHook(() => useRecentRooms());
    await waitFor(() => expect(result.current.rooms).toHaveLength(2));
    expect(result.current.rooms.every((r) => r.status.active === false)).toBe(true);
  });

  it('forget removes a room from the exposed view', async () => {
    rememberRoom('a'); rememberRoom('b');
    const { result } = renderHook(() => useRecentRooms());
    await waitFor(() => expect(result.current.rooms).toHaveLength(2));
    act(() => result.current.forget('a'));
    expect(result.current.rooms.map((r) => r.slug)).toEqual(['b']);
  });
});
