export type ThemeChoice = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(choice: ThemeChoice, osPrefersDark: boolean): ResolvedTheme {
  if (choice === 'auto') return osPrefersDark ? 'dark' : 'light';
  return choice;
}
