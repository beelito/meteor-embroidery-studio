// The old address forwards to the same page on the new site, after a
// moment to read the notice. GitHub serves this page (as 404.html) for every
// path that no longer exists, so /meteor-embroidery-studio/download.html#mac
// goes to the new download.html#mac. Unknown paths go to the home page.
'use strict';

(() => {
  const NEW = 'https://meteor-embroidery-studio.pages.dev';
  const BASE = '/meteor-embroidery-studio';
  const PAGES = ['/', '/features.html', '/download.html', '/faq.html', '/privacy.html', '/stitches.html'];

  let path = location.pathname;
  if (path.startsWith(BASE)) path = path.slice(BASE.length);
  if (path === '' || path === '/index.html') path = '/';
  if (!PAGES.includes(path)) path = '/';
  const hash = /^#[A-Za-z0-9_-]{1,64}$/.test(location.hash) ? location.hash : '';
  const target = NEW + path + hash;

  const go = document.getElementById('go');
  const note = document.getElementById('note');
  if (go) go.href = target;

  let left = 5;
  const tick = () => {
    if (left <= 0) {
      location.replace(target);
      return;
    }
    if (note) note.textContent = `Taking you there in ${left} second${left === 1 ? '' : 's'}. Update your bookmark when you get there.`;
    left -= 1;
    setTimeout(tick, 1000);
  };
  tick();
})();
