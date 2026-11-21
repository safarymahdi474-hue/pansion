/* Runs before first paint (blocking, external so CSP stays strict). */
(function () {
  var mode = 'dark', accent = 'amber';
  try {
    var raw = localStorage.getItem('pansion:theme');
    if (raw) {
      var t = JSON.parse(raw);
      if (t && ['light', 'dark', 'system'].indexOf(t.mode) > -1) mode = t.mode;
      if (t && ['amber', 'blue', 'green', 'violet', 'rose'].indexOf(t.accent) > -1) accent = t.accent;
    }
  } catch (e) { /* storage blocked: defaults */ }
  var resolved = mode;
  if (mode === 'system') {
    resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  var root = document.documentElement;
  root.setAttribute('data-mode', resolved);
  root.setAttribute('data-accent', accent);
})();
