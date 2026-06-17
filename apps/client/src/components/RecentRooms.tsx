import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { RecentRoomView } from '@/lib/recentRooms';

function Standing({ status }: { status: RecentRoomView['status'] }) {
  if (status.active === 'pending') return <span className="text-xs opacity-50">checking…</span>;
  if (status.active === false) return <span className="text-xs opacity-60">no longer available</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-70">
      {status.roundLabel && <span>{status.roundLabel}</span>}
      <span>{status.count} {status.count === 1 ? 'person' : 'people'}</span>
      <span>{status.hasVoted ? 'Voted' : 'No vote yet'}</span>
    </span>
  );
}

/** Recent rooms this browser has joined. Renders nothing when empty. Greyed rows are rooms
 * that are gone or that you're no longer a member of; clicking still attempts a rejoin. */
export function RecentRooms({
  rooms, onForget, onClearAll,
}: {
  rooms: RecentRoomView[];
  onForget: (slug: string) => void;
  onClearAll: () => void;
}) {
  if (rooms.length === 0) return null;
  return (
    <section className="w-full md:w-80" aria-label="Recent rooms">
      <h2 className="mb-2 text-sm font-medium opacity-70">Recent rooms</h2>
      <ul className="flex flex-col gap-2">
        {rooms.map((r) => {
          const gone = r.status.active === false;
          // You can only forget a room you've actually left — hide the dismiss while you
          // still have a live tab open in it, so you don't "close" a room you're using.
          const here = r.status.active === true && r.status.connected;
          return (
            <li
              key={r.slug}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${gone ? 'opacity-50' : ''}`}
            >
              <Link to={`/room/${r.slug}`} className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.slug}</span>
                <Standing status={r.status} />
              </Link>
              {!here && (
                <button
                  type="button"
                  onClick={() => onForget(r.slug)}
                  aria-label={`Remove ${r.slug}`}
                  className="rounded p-1 opacity-60 hover:opacity-100"
                >
                  <X size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onClearAll}
        className="mt-2 text-xs opacity-60 hover:opacity-100"
      >
        Clear all
      </button>
    </section>
  );
}
