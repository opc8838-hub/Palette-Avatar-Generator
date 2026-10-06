/** Persist studio lighting; the transparent viewer shares the DOM background. */
import { useLayoutEffect, useRef, useState } from 'react';

export function useStudioTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('tone-duo-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const animate = mounted.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.dataset.themeTransition = String(animate);
    // Commit transition styles before changing the target palette.
    if (animate) getComputedStyle(root).backgroundColor;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
    try { localStorage.setItem('tone-duo-theme', theme); } catch {}
    mounted.current = true;
    const timer = setTimeout(() => delete root.dataset.themeTransition, animate ? 1100 : 0);
    return () => clearTimeout(timer);
  }, [theme]);
  return { theme, toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') };
}
