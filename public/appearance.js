// Runs before first paint under the existing self-only script policy.
// Only visual preferences are stored. Never store queries, briefs or keys here.
(() => {
  const palette = 'yacht';
  let mode = 'dark';
  try {
    const saved = JSON.parse(localStorage.getItem('apifit.appearance') || 'null');
    // Retire palette previews without resetting the owner's saved light/dark mode.
    if (['light', 'dark'].includes(saved?.mode)) mode = saved.mode;
  } catch { /* Blocked storage or old values must not prevent the app loading. */ }
  document.documentElement.dataset.palette = palette;
  document.documentElement.dataset.mode = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#0c0e0f' : '#f7faf9');
})();
