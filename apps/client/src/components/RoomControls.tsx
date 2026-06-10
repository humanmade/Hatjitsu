import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DECKS, chooseCardPack, type PublicRoom } from '@hmpp/shared';
import { socket } from '@/lib/socket';
import { NameEditor } from './NameEditor';

export function RoomControls({ room, sessionId }: { room: PublicRoom; sessionId: string }) {
  const slug = room.slug;
  const isAdmin = room.adminSessionId === sessionId;
  const me = room.connections.find((c) => c.sessionId === sessionId);
  const anyVoted = room.connections.some((c) => c.voter && c.hasVoted);
  const ack = (res: { ok: true } | { error: string }) => { if ('error' in res) toast.error(res.error); };
  const [label, setLabel] = useState(room.roundLabel);
  useEffect(() => { setLabel(room.roundLabel); }, [room.roundLabel]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <NameEditor slug={slug} currentName={me?.name ?? ''} color={me?.color} />

      <Button variant="secondary" onClick={() => socket.emit('voter:toggle', { slug, targetSessionId: sessionId, voter: !(me?.voter ?? true) }, ack)}>
        {me?.voter ? 'Become observer' : 'Become voter'}
      </Button>

      <Input
        className="w-56" placeholder="Round label (e.g. PROJ-123)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { if (label !== room.roundLabel) socket.emit('round:label', { slug, label }, ack); }}
        aria-label="Round label"
      />

      {isAdmin && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>Deck: {room.cardPack}</DropdownMenuTrigger>
            <DropdownMenuContent className="w-72">
              {Object.keys(DECKS).map((name) => (
                <DropdownMenuItem
                  key={name}
                  onClick={() => socket.emit('cardpack:set', { slug, cardPack: name }, ack)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="flex w-full items-center justify-between gap-4 font-semibold">
                    {name}
                    {room.cardPack === name && <Check className="size-4 text-primary" />}
                  </span>
                  <span className="text-xs text-muted-foreground">{chooseCardPack(name).join(', ')}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => socket.emit('reveal:force', { slug }, ack)} disabled={room.revealed || !anyVoted}>Reveal</Button>
          <Button variant="destructive" onClick={() => socket.emit('vote:reset', { slug }, ack)}>Reset</Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              When a voter leaves: {room.ejectOnLeave ? 'Eject' : 'Keep'}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <DropdownMenuItem
                onClick={() => { if (!room.ejectOnLeave) socket.emit('eject:set', { slug, ejectOnLeave: true }, ack); }}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="flex w-full items-center justify-between gap-4 font-semibold">
                  Eject them {room.ejectOnLeave && <Check className="size-4 text-primary" />}
                </span>
                <span className="text-xs text-muted-foreground">Remove them when they close their tab — synchronous voting.</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { if (room.ejectOnLeave) socket.emit('eject:set', { slug, ejectOnLeave: false }, ack); }}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="flex w-full items-center justify-between gap-4 font-semibold">
                  Keep them {!room.ejectOnLeave && <Check className="size-4 text-primary" />}
                </span>
                <span className="text-xs text-muted-foreground">Keep them in the room so they can return later — asynchronous voting.</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
