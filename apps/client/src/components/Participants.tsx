import type { PublicConnection } from '@hmpp/shared';

export function Participants({ connections, revealed }: { connections: PublicConnection[]; revealed: boolean }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {connections.map((c) => (
        <li key={c.sessionId} className="flex flex-col items-center gap-1">
          <span
            className="h-12 w-12 rounded-md flex items-center justify-center text-white text-sm font-semibold"
            style={{ background: c.color, opacity: c.hasVoted || !c.voter ? 1 : 0.4 }}
          >
            {revealed && c.voter ? (c.vote ?? '–') : c.voter ? (c.hasVoted ? '✓' : '…') : '👁'}
          </span>
          <span className="text-xs max-w-[6rem] truncate">{c.name}</span>
        </li>
      ))}
    </ul>
  );
}
