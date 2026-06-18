import { describe, it, expect } from 'vitest';
import type { HistoryEntry } from '@hmpp/shared';
import { toCsv, toTsv, toMarkdown } from './historyExport';

const rounds: HistoryEntry[] = [
  // votes 3,5,5 -> validVotes [3,5,5], average round(13/3)=4, 2 distinct of 3 voters => not_unanimous
  { label: 'PROJ-1', cardPack: '135', votes: [{ vote: 3 }, { vote: 5 }, { vote: 5 }], timestamp: 1718064000000 },
  // label with comma + quote exercises CSV quoting; no numeric votes => blank average
  { label: 'A,B"C', cardPack: 'tshirt', votes: [{ vote: '?' }], timestamp: 1718064000000 },
];

describe('history export', () => {
  it('CSV: header, comma-quoting of vote lists and fields, blank average', () => {
    const lines = toCsv(rounds).split('\r\n');
    expect(lines[0]).toBe('Round,Time,Pack,Votes,Count,Average,Agreement');
    expect(lines[1]).toBe('PROJ-1,2024-06-11T00:00:00.000Z,135,"3, 5, 5",3,4,not_unanimous');
    expect(lines[2]).toBe('"A,B""C",2024-06-11T00:00:00.000Z,tshirt,?,1,,unanimous');
  });

  it('TSV: tab-separated, votes kept inline', () => {
    const lines = toTsv(rounds).split('\n');
    expect(lines[0]).toBe('Round\tTime\tPack\tVotes\tCount\tAverage\tAgreement');
    expect(lines[1].split('\t')).toEqual(['PROJ-1', '2024-06-11T00:00:00.000Z', '135', '3, 5, 5', '3', '4', 'not_unanimous']);
  });

  it('Markdown: table with header + separator and pipe-escaping', () => {
    const lines = toMarkdown(rounds).split('\n');
    expect(lines[0]).toBe('| Round | Time | Pack | Votes | Count | Average | Agreement |');
    expect(lines[1]).toBe('| --- | --- | --- | --- | --- | --- | --- |');
    expect(lines[2]).toBe('| PROJ-1 | 2024-06-11T00:00:00.000Z | 135 | 3, 5, 5 | 3 | 4 | not_unanimous |');
  });
});
