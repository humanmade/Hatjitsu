import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { resolveTheme, type ThemeChoice } from './resolveTheme';

const KEY = 'hmpp:theme';
type Ctx = { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(
    () => (localStorage.getItem(KEY) as ThemeChoice) || 'auto',
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = resolveTheme(choice, mql.matches);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [choice]);

  const setChoice = (c: ThemeChoice) => { localStorage.setItem(KEY, c); setChoiceState(c); };
  return <ThemeCtx.Provider value={{ choice, setChoice }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
