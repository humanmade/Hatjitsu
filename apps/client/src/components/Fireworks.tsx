import { useEffect, useRef, useState } from 'react';
import { computeVoteResults, type PublicRoom } from '@hmpp/shared';
import { Confetti } from './Confetti';

export function Fireworks({ room }: { room: PublicRoom }) {
  // A burst counter that increments on each false→true unanimous transition. Keying
  // <Confetti> by it remounts a fresh burst every round (no fragile timer in this effect).
  const [burst, setBurst] = useState(0);
  const prevRevealed = useRef(false);
  useEffect(() => {
    const wasRevealed = prevRevealed.current;
    prevRevealed.current = room.revealed;
    if (room.revealed && !wasRevealed) {
      const { voteStatus } = computeVoteResults(room.votes.map((v) => ({ vote: v })), room.votes.length, true);
      if (voteStatus === 'unanimous') setBurst((b) => b + 1);
    }
  }, [room.revealed, room.votes]);

  if (burst === 0) return null;
  return <Confetti key={burst} />;
}
