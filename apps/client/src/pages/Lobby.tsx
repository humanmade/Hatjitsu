import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { socket } from '@/lib/socket';
import { FannedCards } from '@/components/FannedCards';
import { LobbyIdentity } from '@/components/LobbyIdentity';
import { RecentRooms } from '@/components/RecentRooms';
import { useRecentRooms } from '@/lib/useRecentRooms';

export function Lobby() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { rooms, forget, clearAll } = useRecentRooms();
  const create = () => {
    if (creating) return;
    setCreating(true);
    socket.emit('room:create', ({ slug }) => {
      if (slug) navigate(`/room/${slug}`, { viewTransition: true });
      else setCreating(false);
    });
  };
  return (
    // Centre the (non-header) content in the viewport, biased slightly above the true centre
    // so it doesn't sit low. The columns form a natural-width group (not a stretched grid) so
    // the card↔text gap stays fixed and everything left-aligns consistently as width changes.
    <div className="flex min-h-[calc(100dvh-12rem)] items-center justify-center">
      <div className="flex w-full flex-col items-start gap-12 md:w-auto md:flex-row md:items-center md:gap-16">
        <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-start sm:gap-8">
          <FannedCards />
          <div className="flex max-w-xs flex-col items-start gap-6 text-left">
            <LobbyIdentity />
            <p className="text-sm opacity-70">Disposable rooms. No login. Votes hidden until everyone's in.</p>
            <Button size="lg" onClick={create} disabled={creating}>{creating ? 'Creating…' : 'Create a room'}</Button>
          </div>
        </section>
        <RecentRooms rooms={rooms} onForget={forget} onClearAll={clearAll} />
      </div>
    </div>
  );
}
