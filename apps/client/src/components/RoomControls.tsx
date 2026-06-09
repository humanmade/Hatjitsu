import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DECKS, type PublicRoom } from '@hmpp/shared';
import { socket } from '@/lib/socket';
import { NameEditor } from './NameEditor';

export function RoomControls({ room, sessionId }: { room: PublicRoom; sessionId: string }) {
  const slug = room.slug;
  const isAdmin = room.adminSessionId === sessionId;
  const me = room.connections.find((c) => c.sessionId === sessionId);
  const ack = (res: { ok: true } | { error: string }) => { if ('error' in res) toast.error(res.error); };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <NameEditor slug={slug} currentName={me?.name ?? ''} />

      <Button variant="secondary" onClick={() => socket.emit('voter:toggle', { slug, targetSessionId: sessionId, voter: !(me?.voter ?? true) }, ack)}>
        {me?.voter ? 'Become observer' : 'Become voter'}
      </Button>

      <Input
        className="w-56" placeholder="Round label (e.g. PROJ-123)"
        defaultValue={room.roundLabel}
        onBlur={(e) => socket.emit('round:label', { slug, label: e.target.value }, ack)}
      />

      {isAdmin && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>Deck: {room.cardPack}</DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.keys(DECKS).map((name) => (
                <DropdownMenuItem key={name} onClick={() => socket.emit('cardpack:set', { slug, cardPack: name }, ack)}>{name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => socket.emit('reveal:force', { slug }, ack)} disabled={room.revealed}>Reveal</Button>
          <Button variant="destructive" onClick={() => socket.emit('vote:reset', { slug }, ack)}>Reset</Button>
        </>
      )}
    </div>
  );
}
