import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toCsv, toTsv, toMarkdown } from '@/lib/historyExport';
import type { PublicRoom } from '@hmpp/shared';

export function History({ room }: { room: PublicRoom }) {
  const [open, setOpen] = useState(false);
  if (room.history.length === 0) return null;

  const download = (content: string, ext: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${room.slug}-history.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  const FORMATS = [
    { label: 'JSON', run: () => download(JSON.stringify(room.history, null, 2), 'json', 'application/json') },
    { label: 'CSV', run: () => download(toCsv(room.history), 'csv', 'text/csv') },
    { label: 'TSV', run: () => download(toTsv(room.history), 'tsv', 'text/tab-separated-values') },
    { label: 'Markdown', run: () => download(toMarkdown(room.history), 'md', 'text/markdown') },
  ];

  return (
    <section className="w-full max-w-md">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Voting history
          <span className="text-xs opacity-70">({room.history.length})</span>
          <ChevronDown className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div className="mt-4 text-left">
          <ol className="space-y-2">
            {room.history.map((h) => (
              <li
                key={h.timestamp}
                className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-medium">{h.label}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {h.votes.map((v, i) => (
                    <span
                      key={i}
                      className="inline-flex min-w-6 justify-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums"
                    >
                      {String(v.vote)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" />}
                className="gap-1"
              >
                Export
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FORMATS.map(({ label, run }) => (
                  <DropdownMenuItem key={label} onClick={run}>{label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </section>
  );
}
