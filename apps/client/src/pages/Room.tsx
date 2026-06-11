import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socket } from '@/lib/socket';
import { getSessionId, getStoredName, setStoredName, getStoredRole, setStoredRole } from '@/lib/session';
import { useRoom } from '@/store/useRoom';
import { useRoomNotifications } from '@/lib/useRoomNotifications';
import { Deck } from '@/components/Deck';
import { Participants } from '@/components/Participants';
import { RevealedVotes } from '@/components/RevealedVotes';
import { Results } from '@/components/Results';
import { RoomControls } from '@/components/RoomControls';
import { History } from '@/components/History';
import { Fireworks } from '@/components/Fireworks';
import { useIdlePhase } from '@/lib/useIdlePhase';
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
  const idlePhase = useIdlePhase(room);

  const join = (voter: boolean) => {
    setStoredRole(voter);
    roleRef.current = voter;
    setRole(voter);
    socket.emit('room:join', { slug, sessionId, voter, name: getStoredName() }, (res) => {
      if ('error' in res) { toast.error(res.error); return; }
      setRoom(res);
      const mine = res.connections.find((c) => c.sessionId === sessionId);
      if (mine) setStoredName(mine.name);
      setMyVote(res.yourVote != null ? String(res.yourVote) : null);
    });
  };

  if (role === null) {
    return (
      <Card className="mx-auto mt-12 flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Join this room</h1>
        <p className="text-sm opacity-70">Would you like to vote, or just watch?</p>
        <div className="flex gap-3">
          <Button size="lg" onClick={() => join(true)}>Vote</Button>
          <Button size="lg" variant="outline" onClick={() => join(false)}>Watch</Button>
        </div>
      </Card>
    );
  }

  if (!room) return <p>Joining room…</p>;
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
    <div className="flex flex-col items-center gap-10 pt-12 pb-6 text-center">
      <h1 className="text-base font-medium tracking-tight text-muted-foreground">Room: {room.slug}</h1>
      {/* Top "table": who has voted while open; the anonymous results once revealed. */}
      <div className="py-12">
        {room.revealed ? (
          <RevealedVotes votes={room.votes} highlight={revealHighlight} />
        ) : (
          <Participants connections={room.connections} idlePhase={idlePhase} />
        )}
      </div>
      <Results room={room} />
      {room.revealed && (
        <Button
          size="lg"
          onClick={() => socket.emit('vote:reset', { slug }, (res) => { if ('error' in res) toast.error(res.error); })}
        >
          Start new vote
        </Button>
      )}
      {me?.voter && <Deck cardPack={room.cardPack} myVote={myCurrentVote} onPick={pick} disabled={room.revealed} />}
      <RoomControls room={room} sessionId={sessionId} />
      <History room={room} />
      <Fireworks room={room} />
    </div>
  );
}
