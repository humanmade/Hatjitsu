import { computeVoteResults, type HistoryEntry } from '@hmpp/shared';

// Tabular history exports (CSV / TSV / Markdown). JSON keeps its own raw dump.
// Stats per round are derived the same way Room.tsx derives the reveal highlight:
// every archived round is a completed/forced reveal, so voterCount === votes cast.

const COLUMNS = ['Round', 'Time', 'Pack', 'Votes', 'Count', 'Average', 'Agreement'] as const;

function row(h: HistoryEntry): string[] {
  const r = computeVoteResults(h.votes, h.votes.length, true);
  return [
    h.label,
    new Date(h.timestamp).toISOString(),
    h.cardPack,
    h.votes.map((v) => String(v.vote)).join(', '),
    String(h.votes.length),
    r.validVotes.length ? String(r.average) : '',
    r.voteStatus,
  ];
}

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const tsvCell = (s: string) => s.replace(/[\t\n\r]/g, ' ');
const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toCsv(history: HistoryEntry[]): string {
  return [COLUMNS.join(','), ...history.map((h) => row(h).map(csvCell).join(','))].join('\r\n');
}

export function toTsv(history: HistoryEntry[]): string {
  return [COLUMNS.join('\t'), ...history.map((h) => row(h).map(tsvCell).join('\t'))].join('\n');
}

export function toMarkdown(history: HistoryEntry[]): string {
  const header = `| ${COLUMNS.join(' | ')} |`;
  const sep = `| ${COLUMNS.map(() => '---').join(' | ')} |`;
  const rows = history.map((h) => `| ${row(h).map(mdCell).join(' | ')} |`);
  return [header, sep, ...rows].join('\n');
}
