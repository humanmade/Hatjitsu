import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socket } from '@/lib/socket';
import { getSessionId } from '@/lib/session';
import { useRoom } from '@/store/useRoom';
import { Deck } from '@/components/Deck';
import { Participants } from '@/components/Participants';
import { Results } from '@/components/Results';
import { RoomControls } from '@/components/RoomControls';
import { History } from '@/components/History';
import { Fireworks } from '@/components/Fireworks';

export function Room() {
  const { slug = '' } = useParams();
  const { room, setRoom } = useRoom();
  const sessionId = getSessionId();
  const [role, setRole] = useState<boolean | null>(null);
  const roleRef = useRef<boolean | null>(null);

  useEffect(() => {
    useRoom.getState().clear();
    const onUpdate = (r: Parameters<typeof setRoom>[0]) => setRoom(r);
    socket.on('room:update', onUpdate);
    // Re-join with the chosen role on (re)connect.
    const doJoin = () => {
      if (roleRef.current === null) return;
      socket.emit('room:join', { slug, sessionId, voter: roleRef.current }, (res) => {
        if ('error' in res) toast.error(res.error);
        else setRoom(res);
      });
    };
    socket.on('connect', doJoin);
    return () => {
      socket.off('room:update', onUpdate);
      socket.off('connect', doJoin);
      useRoom.getState().clear();
    };
  }, [slug, sessionId, setRoom]);

  const join = (voter: boolean) => {
    roleRef.current = voter;
    setRole(voter);
    socket.emit('room:join', { slug, sessionId, voter }, (res) => {
      if ('error' in res) toast.error(res.error);
      else setRoom(res);
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
  const pick = (vote: string) => socket.emit('vote', { slug, vote }, (res) => { if ('error' in res) toast.error(res.error); });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Room: {room.slug}</h1>
      <Participants connections={room.connections} revealed={room.revealed} />
      {me?.voter && <Deck cardPack={room.cardPack} myVote={me?.vote ?? null} onPick={pick} disabled={room.revealed} />}
      <Results room={room} />
      <RoomControls room={room} sessionId={sessionId} />
      <History room={room} />
      <Fireworks room={room} />
    </div>
  );
}
