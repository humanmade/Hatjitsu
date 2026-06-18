import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socket } from '@/lib/socket';

/** Shown to someone who was switched to observer by the reveal sweep (they didn't vote in
 * time). Both choices clear the `autoDemoted` flag server-side, dismissing this. */
export function RejoinNudge({ slug, sessionId }: { slug: string; sessionId: string }) {
  const ack = (res: { ok: true } | { error: string }) => { if ('error' in res) toast.error(res.error); };
  const choose = (voter: boolean) =>
    socket.emit('voter:toggle', { slug, targetSessionId: sessionId, voter }, ack);

  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-3 p-5 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300">
      <p className="text-sm">
        The round was revealed while you were away, so you’re now an <strong>observer</strong>.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => choose(true)}>Rejoin voting</Button>
        <Button variant="outline" onClick={() => choose(false)}>Stay observer</Button>
      </div>
    </Card>
  );
}
