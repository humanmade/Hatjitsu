import { useEffect, useRef, useState } from 'react';
import { computeVoteResults, type PublicRoom } from '@hmpp/shared';
import { Confetti } from './Confetti';

export function Fireworks({ room }: { room: PublicRoom }) {
  // A burst counter that increments on each false→true unanimous transition. Keying
  // <Confetti> by it remounts a fresh burst every round (no fragile timer in this effect).
  const [burst, setBurst] = useState(0);
  const [glyph, setGlyph] = useState<string | undefined>(undefined);
  const prevRevealed = useRef(false);
  useEffect(() => {
    const wasRevealed = prevRevealed.current;
    prevRevealed.current = room.revealed;
    if (room.revealed && !wasRevealed) {
      const { voteStatus } = computeVoteResults(room.votes.map((v) => ({ vote: v })), room.votes.length, true);
      if (voteStatus === 'unanimous') {
        // Unanimous → every vote is identical, so the shared value is votes[0].
        // Easter egg: if that value is an emoji or "?", rain it alongside the confetti.
        const value = String(room.votes[0] ?? '');
        setGlyph(value === '?' || /\p{Extended_Pictographic}/u.test(value) ? value : undefined);
        setBurst((b) => b + 1);
      }
    }
  }, [room.revealed, room.votes]);

  if (burst === 0) return null;
  return <Confetti key={burst} glyph={glyph} />;
}
