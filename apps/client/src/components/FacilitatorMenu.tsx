import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DECKS, chooseCardPack } from '@hmpp/shared';
import { socket } from '@/lib/socket';
import { getSessionId } from '@/lib/session';
import { useRoom } from '@/store/useRoom';

/** Header cluster of facilitator-only controls (deck picker + seat handoff). Lives in the app
 * header (right side) and reads the active room from the global store, so it appears only for
 * the facilitator while they're in a room. */
export function FacilitatorMenu() {
  const room = useRoom((s) => s.room);
  const sessionId = getSessionId();
  if (!room || room.facilitatorSessionId !== sessionId) return null;

  const slug = room.slug;
  const targets = room.connections.filter((c) => c.connected && c.sessionId !== sessionId);
  const ack = (res: { ok: true } | { error: string }) => { if ('error' in res) toast.error(res.error); };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>Deck: {room.cardPack}</DropdownMenuTrigger>
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

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
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

      {targets.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>Pass facilitator</DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {targets.map((c) => (
              <DropdownMenuItem key={c.sessionId} onClick={() => socket.emit('facilitator:pass', { slug, targetSessionId: c.sessionId }, ack)}>
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
