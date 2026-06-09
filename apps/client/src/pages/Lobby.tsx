import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socket } from '@/lib/socket';

export function Lobby() {
  const navigate = useNavigate();
  const create = () => socket.emit('room:create', ({ slug }) => navigate(`/room/${slug}`));
  return (
    <Card className="p-8 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Start a planning session</h1>
      <p className="text-sm opacity-70">Disposable rooms. No login. Votes hidden until everyone's in.</p>
      <Button size="lg" onClick={create}>Create a room</Button>
    </Card>
  );
}
