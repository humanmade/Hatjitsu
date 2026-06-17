import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PublicRoom, PublicConnection } from '@hmpp/shared';

const toast = vi.fn() as unknown as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn> };
toast.success = vi.fn();
vi.mock('sonner', () => ({ toast: Object.assign((...a: unknown[]) => toast(...a), { success: (...a: unknown[]) => toast.success(...a) }) }));

import { useRoomEventToasts } from './useRoomEventToasts';

const conn = (over: Partial<PublicConnection>): PublicConnection => ({
  sessionId: 'a', name: 'Ada', color: 'red', voter: true, hasVoted: false,
  connected: true, autoDemoted: false, ...over,
});
const room = (over: Partial<PublicRoom>): PublicRoom => ({
  slug: 'r', mode: 'live', facilitatorSessionId: 'a', roundStartedAt: 0, cardPack: '135 set',
  revealed: false, roundLabel: '', history: [], ejectOnLeave: true, votes: [],
  connections: [conn({ sessionId: 'a', name: 'Ada' }), conn({ sessionId: 'b', name: 'Bo' })],
  ...over,
});

beforeEach(() => { toast.mockClear(); toast.success.mockClear(); });

describe('useRoomEventToasts', () => {
  it('does not toast on the first snapshot', () => {
    renderHook(({ r }) => useRoomEventToasts(r, 'me'), { initialProps: { r: room({}) } });
    expect(toast).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('toasts the room when the facilitator changes to someone else', () => {
    const { rerender } = renderHook(({ r }) => useRoomEventToasts(r, 'me'), { initialProps: { r: room({}) } });
    rerender({ r: room({ facilitatorSessionId: 'b' }) });
    expect(toast).toHaveBeenCalledWith('Bo is now facilitating');
  });

  it('greets you specifically when you take the seat', () => {
    const { rerender } = renderHook(({ r }) => useRoomEventToasts(r, 'b'), { initialProps: { r: room({}) } });
    rerender({ r: room({ facilitatorSessionId: 'b' }) });
    expect(toast.success).toHaveBeenCalledWith('You’re now the facilitator');
  });

  it('toasts others (not you) when voters are swept to observer', () => {
    const { rerender } = renderHook(({ r }) => useRoomEventToasts(r, 'a'), { initialProps: { r: room({}) } });
    rerender({ r: room({
      revealed: true,
      connections: [
        conn({ sessionId: 'a', name: 'Ada' }),
        conn({ sessionId: 'b', name: 'Bo', voter: false, autoDemoted: true }),
      ],
    }) });
    expect(toast).toHaveBeenCalledWith('Bo was set to observer (didn’t vote this round)');
  });

  it('does not toast the swept person about their own demotion', () => {
    const { rerender } = renderHook(({ r }) => useRoomEventToasts(r, 'b'), { initialProps: { r: room({}) } });
    rerender({ r: room({
      revealed: true,
      connections: [
        conn({ sessionId: 'a', name: 'Ada' }),
        conn({ sessionId: 'b', name: 'Bo', voter: false, autoDemoted: true }),
      ],
    }) });
    expect(toast).not.toHaveBeenCalled();
  });
});
