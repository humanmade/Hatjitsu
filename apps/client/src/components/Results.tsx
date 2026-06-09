import { computeVoteResults, type PublicRoom } from '@hmpp/shared';

export function Results({ room }: { room: PublicRoom }) {
  if (!room.revealed) return null;
  const voters = room.connections.filter((c) => c.voter);
  const votes = voters.filter((c) => c.vote !== null).map((c) => ({ vote: c.vote }));
  const r = computeVoteResults(votes, voters.length, room.forcedReveal);

  const tone =
    r.voteStatus === 'unanimous' ? 'text-green-500'
    : r.voteStatus === 'problem' ? 'text-red-500'
    : 'opacity-80';

  return (
    <div className="flex items-center gap-6 rounded-md border p-4" style={{ borderColor: 'hsl(var(--border))' }}>
      {r.showAverage && <div><span className="opacity-70">Average</span> <span className="text-2xl font-bold">{r.average}</span></div>}
      <div><span className="opacity-70">Total</span> <span className="font-semibold">{r.total}</span></div>
      <div><span className="opacity-70">Std dev</span> <span className="font-semibold">{r.stddev.toFixed(2)}</span></div>
      <div className={`font-semibold ${tone}`}>{r.voteStatus.replace('_', ' ')}</div>
    </div>
  );
}
