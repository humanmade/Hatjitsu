import { Routes, Route, useLocation } from 'react-router-dom';
import { ThemeToggle } from './theme/ThemeToggle';
import { Lobby } from './pages/Lobby';
import { Room } from './pages/Room';
import { ConnectionStatus } from './components/ConnectionStatus';
import { NotifyToggle } from './components/NotifyToggle';
import { FacilitatorMenu } from './components/FacilitatorMenu';
import { RoomLink } from './components/RoomLink';
import { useSocketDown } from './lib/useConnection';
import { cn } from './lib/utils';

export default function App() {
  const down = useSocketDown();
  const location = useLocation();
  return (
    <div className="min-h-screen">
      {down && <ConnectionStatus />}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4">
        <a href="/" className="group flex shrink-0 items-center gap-2.5 text-lg font-semibold tracking-tight">
          <img src="/hm-mark-red.svg" alt="Human Made" className="h-6 w-auto" />
          <span className="hidden transition-colors group-hover:text-primary sm:inline">Planning Poker</span>
        </a>
        <div className="flex min-w-0 justify-center">
          <RoomLink />
        </div>
        <div className="flex shrink-0 items-center justify-self-end gap-1">
          <FacilitatorMenu />
          <NotifyToggle />
          <ThemeToggle />
        </div>
      </header>
      <main
        className={cn(
          'p-4 max-w-5xl mx-auto transition-opacity',
          down && 'pointer-events-none select-none opacity-50',
        )}
        aria-hidden={down}
      >
        {/* Unkeyed: animate-in runs once on first paint. Route-to-route changes are
            crossfaded by the View Transitions API (see navigate/Link `viewTransition`). */}
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out">
          <Routes location={location}>
            <Route path="/" element={<Lobby />} />
            <Route path="/room/:slug" element={<Room />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
