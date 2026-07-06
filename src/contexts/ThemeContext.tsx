import React, { createContext, useContext, useEffect, useState } from 'react';
import { getUserPreference, setUserPreference } from '@/lib/storage';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      const saved = await getUserPreference('theme');
      const initialTheme = (saved as Theme) || 'light';
      setTheme(initialTheme);
      setInitialized(true);
    };
    loadTheme();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    setUserPreference('theme', theme);
  }, [theme, initialized]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
