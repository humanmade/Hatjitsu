import { describe, it, expect } from 'vitest';
import { mergeRecent } from './recentRooms';
import type { RoomStatus } from '@hmpp/shared';

const recent = [
  { slug: 'a', lastJoinedAt: 2 },
  { slug: 'b', lastJoinedAt: 1 },
];

describe('mergeRecent', () => {
  it('marks rooms pending until a status arrives', () => {
    const view = mergeRecent(recent, []);
    expect(view.map((v) => v.status)).toEqual([{ active: 'pending' }, { active: 'pending' }]);
  });

  it('merges status onto matching slugs', () => {
    const statuses: RoomStatus[] = [
      { slug: 'a', active: true, connected: true, voter: true, hasVoted: true, revealed: false, roundLabel: 'PROJ-1', count: 3, lastActivityAt: 1 },
      { slug: 'b', active: false },
    ];
    const view = mergeRecent(recent, statuses);
    expect(view[0]).toMatchObject({ slug: 'a', status: { active: true, hasVoted: true, count: 3 } });
    expect(view[1]).toMatchObject({ slug: 'b', status: { active: false } });
  });

  it('preserves recent order regardless of status order', () => {
    const statuses: RoomStatus[] = [{ slug: 'b', active: false }, { slug: 'a', active: false }];
    expect(mergeRecent(recent, statuses).map((v) => v.slug)).toEqual(['a', 'b']);
  });
});
