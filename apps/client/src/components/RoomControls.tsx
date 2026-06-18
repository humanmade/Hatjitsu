import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { REVEAL_COOLDOWN_MS, type PublicRoom } from '@hmpp/shared';
import { socket } from '@/lib/socket';
import { NameEditor } from './NameEditor';

export function RoomControls({ room, sessionId }: { room: PublicRoom; sessionId: string }) {
  const slug = room.slug;
  const isFacilitator = room.facilitatorSessionId === sessionId;
  const me = room.connections.find((c) => c.sessionId === sessionId);
  const anyVoted = room.connections.some((c) => c.voter && c.hasVoted);
  const ack = (res: { ok: true } | { error: string }) => { if ('error' in res) toast.error(res.error); };
  const [label, setLabel] = useState(room.roundLabel);
  useEffect(() => { setLabel(room.roundLabel); }, [room.roundLabel]);

  // The seat is up for grabs when nobody holds it, or its holder has dropped off.
  const holder = room.connections.find((c) => c.sessionId === room.facilitatorSessionId);
  const claimable = !room.facilitatorSessionId || !holder || !holder.connected;

  // Manual reveal is on cooldown for the opening window of each round; tick so the countdown
  // updates and the button re-enables on its own.
  const [now, setNow] = useState(() => Date.now());
  const revealAt = room.roundStartedAt + REVEAL_COOLDOWN_MS;
  const coolingDown = !room.revealed && now < revealAt;
  useEffect(() => {
    if (!coolingDown) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [coolingDown]);
  const remainingSec = Math.max(0, Math.ceil((revealAt - now) / 1000));

  const showReset = anyVoted || room.revealed;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <NameEditor slug={slug} currentName={me?.name ?? ''} color={me?.color} />

      <Button variant="secondary" onClick={() => socket.emit('voter:toggle', { slug, targetSessionId: sessionId, voter: !(me?.voter ?? true) }, ack)}>
        {me?.voter ? 'Become observer' : 'Become voter'}
      </Button>

      <Input
        className="w-44" placeholder="Round label (e.g. PROJ-123)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { if (label !== room.roundLabel) socket.emit('round:label', { slug, label }, ack); }}
        aria-label="Round label"
      />

      {/* Reveal and reset are available to everyone — a room never gets stuck waiting on one
          person. Only shown when there's actually something to reveal (a vote is in, and the
          round isn't already revealed); it waits out the opening cooldown so stragglers aren't
          swept to observer. */}
      {anyVoted && !room.revealed && (
        <Button onClick={() => socket.emit('reveal:force', { slug }, ack)} disabled={coolingDown}>
          {coolingDown ? `Reveal in ${remainingSec}s` : 'Reveal'}
        </Button>
      )}
      {showReset && (
        <Button variant="destructive" onClick={() => socket.emit('vote:reset', { slug }, ack)}>Reset</Button>
      )}

      {/* Claim a vacant/abandoned seat. The facilitator-only controls (deck, eject, pass)
          live in the header menu. */}
      {!isFacilitator && claimable && (
        <Button variant="outline" onClick={() => socket.emit('facilitator:claim', { slug }, ack)}>
          Take control
        </Button>
      )}
    </div>
  );
}
