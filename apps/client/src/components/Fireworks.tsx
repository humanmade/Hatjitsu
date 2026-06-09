import { useEffect, useRef, useState } from 'react';
import { computeVoteResults, type PublicRoom } from '@hmpp/shared';
import { Confetti } from './Confetti';

export function Fireworks({ room }: { room: PublicRoom }) {
  const [show, setShow] = useState(false);
  const prevRevealed = useRef(false);
  useEffect(() => {
    if (!room.revealed) { prevRevealed.current = false; return; }
    if (prevRevealed.current) return;
    prevRevealed.current = true;
    const voters = room.connections.filter((c) => c.voter);
    const votes = voters.filter((c) => c.vote !== null).map((c) => ({ vote: c.vote }));
    const { voteStatus } = computeVoteResults(votes, voters.length, room.forcedReveal);
    if (voteStatus === 'unanimous') {
      setShow(true);
      const t = setTimeout(() => setShow(false), 4500);
      return () => clearTimeout(t);
    }
  }, [room.revealed, room.connections, room.forcedReveal]);

  if (!show) return null;
  return <Confetti />;
}
