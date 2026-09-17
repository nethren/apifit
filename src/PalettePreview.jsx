import React, { useEffect, useState } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';
import { defaultPalette } from './palettes.mjs';

export function PalettePreview() {
  const palette = defaultPalette;
  const [mode, setMode] = useState(() => document.documentElement.dataset.mode || 'dark');
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    document.documentElement.dataset.mode = mode;
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
    try { localStorage.setItem('apifit.appearance', JSON.stringify({ palette, mode })); }
    catch { /* Appearance still works when browser storage is unavailable. */ }
  }, [palette, mode]);

  return <div className="appearance-controls"><button className="mode-toggle" aria-label="Dark mode" aria-pressed={mode === 'dark'} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setMode(current => current === 'dark' ? 'light' : 'dark')}>
    {mode === 'dark' ? <Moon size={17} aria-hidden="true"/> : <Sun size={17} aria-hidden="true"/>}
    <span>{mode === 'dark' ? 'Dark' : 'Light'}</span>
  </button></div>;
}
