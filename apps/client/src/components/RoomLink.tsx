import { toast } from 'sonner';
import { useRoom } from '@/store/useRoom';

/** Small centered room slug in the header; click to copy the shareable room link. Reads the
 * active room from the global store, so it only appears while you're in a room. */
export function RoomLink() {
  const room = useRoom((s) => s.room);
  if (!room) return null;

  const copy = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success('Room link copied'))
      .catch(() => toast.error('Couldn’t copy the link'));
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy room link"
      className="max-w-full cursor-pointer truncate rounded px-2 py-1 text-xs font-semibold tracking-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {room.slug}
    </button>
  );
}
