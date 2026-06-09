import { Button } from '@/components/ui/button';
import type { PublicRoom } from '@hmpp/shared';

export function History({ room }: { room: PublicRoom }) {
  if (room.history.length === 0) return null;
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(room.history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${room.slug}-history.json`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-md border p-4" style={{ borderColor: 'hsl(var(--border))' }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">History</h2>
        <Button variant="outline" size="sm" onClick={exportJson}>Export JSON</Button>
      </div>
      <ul className="space-y-1 text-sm">
        {room.history.map((h, i) => (
          <li key={i}><span className="font-medium">{h.label}</span> — {h.votes.map((v) => String(v.vote)).join(', ')} <span className="opacity-60">({h.cardPack})</span></li>
        ))}
      </ul>
    </div>
  );
}
