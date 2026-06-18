import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { getSessionId, getStoredName, setStoredName, getStoredRole, setStoredRole, rememberRoom } from '@/lib/session';
import { useRoom } from '@/store/useRoom';
import { useRoomNotifications } from '@/lib/useRoomNotifications';
import { AutoHeight } from '@/components/AutoHeight';
import { Deck } from '@/components/Deck';
import { Participants } from '@/components/Participants';
import { RevealedVotes } from '@/components/RevealedVotes';
import { Results } from '@/components/Results';
import { RoomControls } from '@/components/RoomControls';
import { RejoinNudge } from '@/components/RejoinNudge';
import { History } from '@/components/History';
import { Fireworks } from '@/components/Fireworks';
import { useIdlePhase } from '@/lib/useIdlePhase';
import { useRoomEventToasts } from '@/lib/useRoomEventToasts';
import { computeVoteResults } from '@hmpp/shared';

export function Room() {
  const { slug = '' } = useParams();
  const { room, setRoom } = useRoom();
  const sessionId = getSessionId();
  const [role, setRole] = useState<boolean | null>(() => getStoredRole());
  const roleRef = useRef<boolean | null>(getStoredRole());
  // The server keeps votes anonymous and doesn't echo our own back, so we track it locally
  // to highlight our pick in the deck before reveal.
  const [myVote, setMyVote] = useState<string | null>(null);

  useEffect(() => {
    useRoom.getState().clear();
    const remember = (r: Parameters<typeof setRoom>[0]) => {
      setRoom(r);
      const mine = r.connections.find((c) => c.sessionId === sessionId);
      if (mine) setStoredName(mine.name); // keep our (possibly uniquified) name across refreshes
    };
    socket.on('room:update', remember);
    // Join, or re-join on (re)connect, with the remembered role + name.
    const doJoin = () => {
      if (roleRef.current === null) return;
      socket.emit('room:join', { slug, sessionId, voter: roleRef.current, name: getStoredName() }, (res) => {
        if ('error' in res) { toast.error(res.error); return; }
        remember(res);
        rememberRoom(slug);
        setMyVote(res.yourVote != null ? String(res.yourVote) : null); // restore own highlight
      });
    };
    if (socket.connected) doJoin();
    socket.on('connect', doJoin);
    return () => {
      socket.off('room:update', remember);
      socket.off('connect', doJoin);
      useRoom.getState().clear();
    };
  }, [slug, sessionId, setRoom]);

  useRoomNotifications(room);
  useRoomEventToasts(room, sessionId);
  const idlePhase = useIdlePhase(room);

  // Sequence the deck's appearance to mirror its exit. Entering: it's mounted but invisible at
  // full height, so AutoHeight expands the space FIRST, then it fades in. Leaving: it fades out
  // FIRST, then unmounts so AutoHeight collapses the freed space. Each leg runs ~200ms. Voter
  // status is read here (above the early returns) so the hook order stays stable.
  const meVoter = !!room?.connections.find((c) => c.sessionId === sessionId)?.voter;
  const [deckPhase, setDeckPhase] = useState<'out' | 'entering' | 'shown' | 'leaving'>(
    meVoter ? 'shown' : 'out',
  );
  // Trigger: start an enter or leave whenever our voter status flips.
  useEffect(() => {
    if (meVoter) setDeckPhase((p) => (p === 'shown' ? p : 'entering'));
    else setDeckPhase((p) => (p === 'out' ? p : 'leaving'));
  }, [meVoter]);
  // Advance: after each transient leg settles, move to the resting phase.
  useEffect(() => {
    if (deckPhase === 'entering') {
      const t = setTimeout(() => setDeckPhase((p) => (p === 'entering' ? 'shown' : p)), 200);
      return () => clearTimeout(t);
    }
    if (deckPhase === 'leaving') {
      const t = setTimeout(() => setDeckPhase((p) => (p === 'leaving' ? 'out' : p)), 200);
      return () => clearTimeout(t);
    }
  }, [deckPhase]);

  const join = (voter: boolean) => {
    setStoredRole(voter);
    roleRef.current = voter;
    setRole(voter);
    socket.emit('room:join', { slug, sessionId, voter, name: getStoredName() }, (res) => {
      if ('error' in res) { toast.error(res.error); return; }
      setRoom(res);
      const mine = res.connections.find((c) => c.sessionId === sessionId);
      if (mine) setStoredName(mine.name);
      rememberRoom(slug);
      setMyVote(res.yourVote != null ? String(res.yourVote) : null);
    });
  };

  if (role === null) {
    return (
      <Card className="mx-auto mt-12 flex max-w-md flex-col items-center gap-4 p-8 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:ease-out">
        <h1 className="text-2xl font-bold">Join this room</h1>
        <p className="text-sm opacity-70">Would you like to vote, or just watch?</p>
        <div className="flex gap-3">
          <Button size="lg" onClick={() => join(true)}>Vote</Button>
          <Button size="lg" variant="outline" onClick={() => join(false)}>Watch</Button>
        </div>
      </Card>
    );
  }

  if (!room)
    return (
      <Card className="mx-auto mt-12 flex max-w-md flex-col items-center gap-4 p-8 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <Loader2Icon className="size-6 text-muted-foreground motion-safe:animate-spin" aria-hidden />
        <p className="text-sm text-muted-foreground">Joining room…</p>
      </Card>
    );
  const me = room.connections.find((c) => c.sessionId === sessionId);
  const pick = (vote: string) => {
    setMyVote(vote);
    socket.emit('vote', { slug, vote }, (res) => { if ('error' in res) toast.error(res.error); });
  };
  const myCurrentVote = me?.hasVoted ? myVote : null; // cleared when the round resets

  const revealHighlight = room.revealed
    ? (() => {
        const st = computeVoteResults(room.votes.map((v) => ({ vote: v })), room.votes.length, true).voteStatus;
        return st === 'unanimous' ? 'unanimous' : st === 'problem' ? 'problem' : null;
      })()
    : null;

  return (
    <div className="flex flex-col items-center gap-10 pt-12 pb-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 motion-safe:ease-out">
      {/* Top "table": who has voted while open; the anonymous results once revealed.
          AutoHeight grows/shrinks the table smoothly as the small voter cards swap for
          the larger revealed cards, instead of snapping to the new height. */}
      <AutoHeight>
        <div className="py-12">
          {room.revealed ? (
            <RevealedVotes votes={room.votes} highlight={revealHighlight} />
          ) : (
            <Participants connections={room.connections} facilitatorSessionId={room.facilitatorSessionId} idlePhase={idlePhase} />
          )}
        </div>
      </AutoHeight>
      {me?.autoDemoted && <RejoinNudge slug={slug} sessionId={sessionId} />}
      <Results room={room} />
      {room.revealed && (
        <Button
          size="lg"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out"
          onClick={() => socket.emit('vote:reset', { slug }, (res) => { if ('error' in res) toast.error(res.error); })}
        >
          Start new vote
        </Button>
      )}
      {/* Grow/collapse the deck slot when toggling voter↔observer instead of snapping the
          layout. The -mt-10 cancels this section's top flex gap and the inner pt-10 restores
          it as measured height, so collapsing folds the gap away with no residual whitespace. */}
      <AutoHeight className="-mt-10">
        {deckPhase !== 'out' && (
          <div
            className={cn(
              'pt-10 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out',
              // 'shown' is the only visible state; 'entering' (pre-expand) and 'leaving' both
              // sit hidden + nudged down, so it slides up in and back down out.
              deckPhase === 'shown' ? 'opacity-100' : 'motion-safe:opacity-0 motion-safe:translate-y-2',
            )}
          >
            <Deck cardPack={room.cardPack} myVote={myCurrentVote} onPick={pick} disabled={room.revealed} />
          </div>
        )}
      </AutoHeight>
      <RoomControls room={room} sessionId={sessionId} />
      <History room={room} />
      <Fireworks room={room} />
    </div>
  );
}
