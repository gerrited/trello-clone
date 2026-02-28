import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useThemeStore } from '../../stores/themeStore.js';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemeStore((s) => s.preference);

  useEffect(() => {
    const root = document.documentElement;

    if (preference === 'dark') {
      root.classList.add('dark');
      return;
    }

    if (preference === 'light') {
      root.classList.remove('dark');
      return;
    }

    // System mode: sync with OS preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      root.classList.toggle('dark', e.matches);
    };

    root.classList.toggle('dark', mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [preference]);

  return <>{children}</>;
}
