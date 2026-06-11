import { Loader2Icon } from 'lucide-react';

// Fixed offline banner. Rendered by App only while disconnected.
export function ConnectionStatus() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-white shadow-md"
    >
      <Loader2Icon className="size-4 motion-safe:animate-spin" aria-hidden />
      <span>Connection lost &mdash; reconnecting&hellip;</span>
    </div>
  );
}
