import { Routes, Route } from 'react-router-dom';
import { ThemeToggle } from './theme/ThemeToggle';
import { Lobby } from './pages/Lobby';
import { Room } from './pages/Room';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useConnection } from './lib/useConnection';
import { cn } from './lib/utils';

export default function App() {
  const connected = useConnection();
  return (
    <div className="min-h-screen">
      {!connected && <ConnectionStatus />}
      <header className="flex items-center justify-between p-4">
        <a href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <img src="/hm-mark-red.svg" alt="Human Made" className="h-6 w-auto" />
          <span>Planning Poker</span>
        </a>
        <ThemeToggle />
      </header>
      <main
        className={cn(
          'p-4 max-w-5xl mx-auto transition-opacity',
          !connected && 'pointer-events-none select-none opacity-50',
        )}
        aria-hidden={!connected}
      >
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:slug" element={<Room />} />
        </Routes>
      </main>
    </div>
  );
}
