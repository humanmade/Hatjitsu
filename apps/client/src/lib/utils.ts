import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Compact, human relative time, e.g. "just now", "5m ago", "3h ago", "4 days ago". */
export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  const w = Math.round(d / 7);
  if (d < 30) return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
  const mo = Math.round(d / 30);
  return `${mo} ${mo === 1 ? 'month' : 'months'} ago`;
}
