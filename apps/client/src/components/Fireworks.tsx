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
    const voterCount = room.connections.filter((c) => c.voter).length;
    const { voteStatus } = computeVoteResults(room.votes.map((v) => ({ vote: v })), voterCount, room.forcedReveal);
    if (voteStatus === 'unanimous') {
      setShow(true);
      const t = setTimeout(() => setShow(false), 4500);
      return () => clearTimeout(t);
    }
  }, [room.revealed, room.votes, room.connections, room.forcedReveal]);

  if (!show) return null;
  return <Confetti />;
}
