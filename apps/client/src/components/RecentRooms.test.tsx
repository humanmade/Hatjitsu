import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentRooms } from './RecentRooms';
import type { RecentRoomView } from '@/lib/recentRooms';

const view = (over: Partial<RecentRoomView> & { slug: string }): RecentRoomView => ({
  lastJoinedAt: 1, status: { active: 'pending' }, ...over,
});

const renderList = (rooms: RecentRoomView[], onForget = vi.fn(), onClearAll = vi.fn()) =>
  render(
    <MemoryRouter>
      <RecentRooms rooms={rooms} onForget={onForget} onClearAll={onClearAll} />
    </MemoryRouter>,
  );

describe('RecentRooms', () => {
  it('renders nothing when the list is empty', () => {
    const { container } = renderList([]);
    expect(container.firstChild).toBeNull();
  });

  it('shows an active room with its standing and a Voted badge', () => {
    renderList([
      view({ slug: 'happy-otter', status: { slug: 'happy-otter', active: true, voter: true, hasVoted: true, revealed: false, roundLabel: 'PROJ-1', count: 3 } }),
    ]);
    expect(screen.getByRole('link', { name: /happy-otter/ })).toHaveAttribute('href', '/room/happy-otter');
    expect(screen.getByText(/Voted/)).toBeInTheDocument();
    expect(screen.getByText(/PROJ-1/)).toBeInTheDocument();
  });

  it('greys inactive rooms and dismiss calls onForget', () => {
    const onForget = vi.fn();
    renderList([view({ slug: 'gone', status: { slug: 'gone', active: false } })], onForget);
    fireEvent.click(screen.getByRole('button', { name: /remove gone/i }));
    expect(onForget).toHaveBeenCalledWith('gone');
  });

  it('Clear all calls onClearAll', () => {
    const onClearAll = vi.fn();
    renderList([view({ slug: 'a' })], vi.fn(), onClearAll);
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalled();
  });
});
