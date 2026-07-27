'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((state) => state.theme);
  const hasHydrated = useAppStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      
      // Fica escutando se o usuário mudar a configuração do celular com o app aberto
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
      
    } else {
      root.classList.add(theme);
    }
  }, [theme, hasHydrated]);

  return <>{children}</>;
}
