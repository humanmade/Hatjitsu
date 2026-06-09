import { Routes, Route } from 'react-router-dom';
import { ThemeToggle } from './theme/ThemeToggle';
import { Lobby } from './pages/Lobby';
import { Room } from './pages/Room';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <img src="/hm-mark-red.svg" alt="Human Made" className="h-7 w-auto" />
          <span>Planning Poker</span>
        </a>
        <ThemeToggle />
      </header>
      <main className="p-4 max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:slug" element={<Room />} />
        </Routes>
      </main>
    </div>
  );
}
