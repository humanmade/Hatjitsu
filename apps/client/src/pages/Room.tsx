import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
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

  useEffect(() => {
    const onUpdate = (r: Parameters<typeof setRoom>[0]) => setRoom(r);
    socket.on('room:update', onUpdate);
    const doJoin = () => socket.emit('room:join', { slug, sessionId }, (res) => {
      if ('error' in res) toast.error(res.error); else setRoom(res);
    });
    if (socket.connected) doJoin();
    socket.on('connect', doJoin); // re-join on reconnect
    return () => { socket.off('room:update', onUpdate); socket.off('connect', doJoin); };
  }, [slug, sessionId, setRoom]);

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
