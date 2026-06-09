import { useEffect, useState } from 'react';
import { computeVoteResults, type PublicRoom } from '@hmpp/shared';

export function Fireworks({ room }: { room: PublicRoom }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!room.revealed) return;
    const voters = room.connections.filter((c) => c.voter);
    const votes = voters.filter((c) => c.vote !== null).map((c) => ({ vote: c.vote }));
    const { voteStatus } = computeVoteResults(votes, voters.length, room.forcedReveal);
    if (voteStatus === 'unanimous') {
      setShow(true);
      const t = setTimeout(() => setShow(false), 2500);
      return () => clearTimeout(t);
    }
  }, [room.revealed, room.connections, room.forcedReveal]);

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="text-6xl animate-bounce motion-reduce:animate-none">🎉</div>
    </div>
  );
}
