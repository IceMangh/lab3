import { useLayoutEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'graph-lab-theme';
export const normalizeTheme = value => value === 'light' ? 'light' : 'dark';

export function readTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY) || document.documentElement.dataset.theme);
  } catch { return 'dark'; }
}

export function applyTheme(theme) {
  const value = normalizeTheme(theme);
  const background = value === 'light' ? '#ffffff' : '#0b0b0b';
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  document.documentElement.style.backgroundColor = background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch {}
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useLayoutEffect(() => { applyTheme(theme); }, [theme]);
  return { theme, setTheme };
}
