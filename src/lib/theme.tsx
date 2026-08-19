import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'securegate-theme';

function getInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  // Default to dark — the aurora glass system is designed dark-first.
  return 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  paintBrowserChrome(root);
}

// The status bar of the INSTALLED app is painted from <meta name="theme-color">,
// and nothing else on the phone can be asked to repaint it. It is rewritten here
// rather than declared twice in index.html with a prefers-color-scheme pair,
// because the theme above is a stored choice that ignores the OS entirely — so
// the OS query would be answering a different question from the one the user
// just answered by pressing the toggle.
//
// The COLOUR is read back off the --c-surface-50 token, never written as a hex
// here: that token is what the app surface behind the topbar is painted with,
// and a rebrand that moves it must move the status bar with it. Reading it
// after the class flip is what makes the two the same value by construction.
function paintBrowserChrome(root: HTMLElement) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  // jsdom applies no stylesheet, so this is empty under test — leaving the
  // markup's own value in place rather than painting the chrome `rgb()`.
  const surface = getComputedStyle(root).getPropertyValue('--c-surface-50').trim();
  if (surface) meta.setAttribute('content', `rgb(${surface})`);
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => undefined,
  setTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
