import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socket } from '@/lib/socket';

export function Lobby() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const create = () => {
    if (creating) return;
    setCreating(true);
    socket.emit('room:create', ({ slug }) => {
      if (slug) navigate(`/room/${slug}`);
      else setCreating(false);
    });
  };
  return (
    <Card className="p-8 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Start a planning session</h1>
      <p className="text-sm opacity-70">Disposable rooms. No login. Votes hidden until everyone's in.</p>
      <Button size="lg" onClick={create} disabled={creating}>{creating ? 'Creating…' : 'Create a room'}</Button>
    </Card>
  );
}
