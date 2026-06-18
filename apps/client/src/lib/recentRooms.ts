import type { RoomStatus } from '@hmpp/shared';
import type { RecentRoom } from './session';

/** A remembered room plus its merged status. `pending` = status request not yet answered. */
export type RecentRoomView = {
  slug: string;
  lastJoinedAt: number;
  status: { active: 'pending' } | RoomStatus;
};

/** Join the localStorage list with status responses, preserving the list's (recent-first) order. */
export function mergeRecent(recent: RecentRoom[], statuses: RoomStatus[]): RecentRoomView[] {
  const bySlug = new Map(statuses.map((s) => [s.slug, s]));
  return recent.map((r) => ({
    slug: r.slug,
    lastJoinedAt: r.lastJoinedAt,
    status: bySlug.get(r.slug) ?? { active: 'pending' as const },
  }));
}
