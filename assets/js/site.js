// Meteor website: motion pieces drawn from the app's own stitch output.
// Security notes: only same-origin JSON is fetched, it is validated before
// use, and no text from it reaches the DOM except through textContent.
'use strict';

document.documentElement.classList.add('js');

(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  // Older links led to sections of one long page. Keep those bookmarks useful.
  const oldSections = { how: 'features.html#how', pictures: 'features.html#pictures', features: 'features.html',
    wand: 'features.html#wand', studio: 'features.html#studio', stitches: 'stitches.html#stitches',
    faq: 'faq.html', download: 'download.html', machine: 'download.html#machine' };
  if (document.body.classList.contains('page-home') && oldSections[location.hash.slice(1)]) {
    location.replace(new URL(oldSections[location.hash.slice(1)], document.baseURI).href);
    return;
  }

  // Small entrances run once. Nothing tracks or scrubs the visitor's scrolling.
  if (!reduceMotion.matches && 'IntersectionObserver' in window) {
    const reveals = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        reveals.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
      el.classList.add('reveal-ready');
      reveals.observe(el);
    });
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) document.querySelectorAll('.reveal-ready').forEach((el) => el.classList.add('is-revealed'));
    });
  }

  // ------------------------------------------------------------- utilities

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (rgb, to, t) => rgb.map((c, i) => Math.round(c + (to[i] - c) * t));
  const css = (rgb, a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Sizes a canvas's backing store to its CSS box; returns its CSS size */
  const fitCanvas = (canvas) => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const ratio = dpr();
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { w, h, ctx };
  };

  /** Runs [frame] on animation frames only while [el] is on screen and the tab is visible */
  const whileVisible = (el, frame) => {
    let onScreen = false, raf = 0;
    const loop = (t) => {
      raf = 0;
      if (!onScreen || document.hidden) return;
      if (frame(t) !== false) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        kick();
      }, { rootMargin: '80px' }).observe(el);
    } else {
      onScreen = true;
    }
    document.addEventListener('visibilitychange', kick);
    kick();
    return kick;
  };

  // ------------------------------------------------------- stitch data

  const MAX_STITCHES = 60000;
  const isInt = (v) => Number.isInteger(v) && Math.abs(v) < 100000;
  const validObject = (o) =>
    o && typeof o === 'object' &&
    typeof o.name === 'string' && o.name.length <= 60 &&
    typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) &&
    Array.isArray(o.stitches) && o.stitches.length % 3 === 0 && o.stitches.length <= MAX_STITCHES * 3 &&
    o.stitches.every(isInt);
  const validDesign = (d) =>
    d && isInt(d.w) && isInt(d.h) && d.w > 0 && d.h > 0 &&
    Array.isArray(d.objects) && d.objects.length <= 64 && d.objects.every(validObject);

  /** Same-origin JSON only; anything unexpected is refused */
  const loadJson = async (path) => {
    const url = new URL(path, document.baseURI);
    if (url.origin !== window.location.origin) throw new Error('Refusing cross-origin data');
    const res = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
    if (!res.ok) throw new Error(`Could not load ${path}`);
    const type = res.headers.get('content-type') || '';
    if (type && !/json/i.test(type)) throw new Error('Unexpected content type');
    return res.json();
  };

  /** One design: a list of stitches with their object, ready to sew */
  const flatten = (design) => {
    const list = [];
    design.objects.forEach((o, oi) => {
      const s = o.stitches;
      for (let i = 0; i < s.length; i += 3) list.push({ x: s[i], y: s[i + 1], t: s[i + 2], o: oi });
    });
    return list;
  };

  // ------------------------------------------------------ thread renderer

  /**
   * Draws stitch [i] of [list] (from the stitch before it) as thread: a soft
   * shadow, the thread in its color, and a highlight along its lit side.
   */
  const drawStitch = (ctx, list, i, colors, scale, ox, oy, threadWidth) => {
    const p = list[i], q = list[i - 1];
    // (jumps, and the move from one object to the next, sew nothing)
    if (!q || p.t === 2 || q.o !== p.o) return;
    const ax = ox + q.x * scale, ay = oy + q.y * scale, bx = ox + p.x * scale, by = oy + p.y * scale;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.2) return;
    const c = colors[p.o];
    const under = p.t === 1;
    const w = threadWidth * (under ? 0.7 : 1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(c.shadow, under ? 0.25 : 0.55);
    ctx.lineWidth = w * 1.25;
    ctx.beginPath(); ctx.moveTo(ax + 0.4, ay + 0.6); ctx.lineTo(bx + 0.4, by + 0.6); ctx.stroke();
    ctx.strokeStyle = css(under ? c.dark : c.base, under ? 0.6 : 1);
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    if (!under) {
      // The twist catches light on the upper side of each stitch
      const nx = -(by - ay) / len, ny = (bx - ax) / len, k = ny > 0 ? -1 : 1;
      const off = w * 0.18 * k;
      ctx.strokeStyle = css(c.light, 0.85);
      ctx.lineWidth = w * 0.32;
      const inset = Math.min(len * 0.18, w);
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      ctx.beginPath();
      ctx.moveTo(ax + ux * inset + nx * off, ay + uy * inset + ny * off);
      ctx.lineTo(bx - ux * inset + nx * off, by - uy * inset + ny * off);
      ctx.stroke();
    }
  };

  const palette = (design) =>
    design.objects.map((o) => {
      const base = hexToRgb(o.color);
      return { base, light: mix(base, [255, 255, 255], 0.42), dark: mix(base, [0, 0, 0], 0.25), shadow: mix(base, [0, 0, 0], 0.7) };
    });

  /** The needle: a steel shaft above the last drop, with its thread */
  const drawNeedle = (ctx, x, y, color, lift) => {
    const top = y - 46 - lift;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(color, 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + 2.5, top + 8); ctx.lineTo(x, y - lift); ctx.stroke();
    const g = ctx.createLinearGradient(x - 2, 0, x + 2, 0);
    g.addColorStop(0, '#6b6e7a'); g.addColorStop(0.5, '#f1f2f7'); g.addColorStop(1, '#5b5e69');
    ctx.strokeStyle = g;
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y - lift - 1); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 0.7, top + 6, 1.4, 5);
    // where the needle goes in
    ctx.fillStyle = css(color, 0.35 + 0.4 * (1 - lift / 6));
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /**
   * Sews [design] into [canvas]: stitches are laid down at [rate] per
   * second into a layer of thread, with the needle drawn on top. Returns a
   * controller to restart it with another design.
   */
  const sewingCanvas = (canvas, { rate = 320, onStitch, padding = 0.06, hold = 2600, loop = false } = {}) => {
    const layer = document.createElement('canvas');
    let design = null, list = [], colors = [], done = 0, startedAt = 0, last = 0, finishedAt = 0;
    let geom = { scale: 1, ox: 0, oy: 0, w: 0, h: 0, thread: 1 };

    const layout = () => {
      const { w, h } = fitCanvas(canvas);
      const ratio = dpr();
      layer.width = canvas.width; layer.height = canvas.height;
      const lctx = layer.getContext('2d');
      lctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!design) return;
      const pad = Math.min(w, h) * padding;
      const scale = Math.min((w - 2 * pad) / design.w, (h - 2 * pad) / design.h);
      geom = { scale, ox: (w - design.w * scale) / 2, oy: (h - design.h * scale) / 2, w, h, thread: clamp(4.2 * scale, 1.1, 3.4) };
      drawGuide();
      // Redraw what is already sewn at the new size
      for (let i = 1; i < done; i++) drawStitch(lctx, list, i, colors, geom.scale, geom.ox, geom.oy, geom.thread);
    };

    // The whole design as faint hairlines, as the studio previews it, so the
    // piece reads before (and while) the thread goes down over it
    const guide = document.createElement('canvas');
    const drawGuide = () => {
      guide.width = canvas.width; guide.height = canvas.height;
      const g = guide.getContext('2d');
      const ratio = dpr();
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.lineWidth = 0.8;
      for (let i = 1; i < list.length; i++) {
        const p = list[i], q = list[i - 1];
        if (p.t !== 0 || q.o !== p.o) continue;
        g.strokeStyle = css(colors[p.o].base, 0.28);
        g.beginPath();
        g.moveTo(geom.ox + q.x * geom.scale, geom.oy + q.y * geom.scale);
        g.lineTo(geom.ox + p.x * geom.scale, geom.oy + p.y * geom.scale);
        g.stroke();
      }
    };

    const sewTo = (n) => {
      const lctx = layer.getContext('2d');
      for (let i = Math.max(1, done); i < n; i++) {
        drawStitch(lctx, list, i, colors, geom.scale, geom.ox, geom.oy, geom.thread);
      }
      done = n;
      if (onStitch && list[n - 1]) onStitch(n, list[n - 1].o, design);
    };

    const paint = (now) => {
      const ctx = canvas.getContext('2d');
      const ratio = dpr();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (done < list.length) ctx.drawImage(guide, 0, 0);
      ctx.drawImage(layer, 0, 0);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (done > 0 && done < list.length) {
        const p = list[done - 1];
        const lift = (Math.sin(now / 38) + 1) * 3;
        drawNeedle(ctx, geom.ox + p.x * geom.scale, geom.oy + p.y * geom.scale, colors[p.o].light, lift);
      }
    };

    const frame = (now) => {
      if (!design) return false;
      if (!startedAt) { startedAt = now; last = now; }
      if (done < list.length) {
        const dt = Math.min(64, now - last);
        // Fills sew quickly; the needle slows down for the first stitches
        const ramp = clamp((now - startedAt) / 900, 0.25, 1);
        const n = Math.min(list.length, done + Math.max(1, Math.round((rate * ramp * dt) / 1000)));
        sewTo(n);
        if (done >= list.length) finishedAt = now;
      } else if (loop && now - finishedAt > hold) {
        restart();
      }
      last = now;
      paint(now);
      return loop || done < list.length;
    };

    const restart = () => {
      done = 0; startedAt = 0; finishedAt = 0;
      const lctx = layer.getContext('2d');
      lctx.save(); lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, layer.width, layer.height); lctx.restore();
    };

    const show = (d, { animate = true } = {}) => {
      design = d; list = flatten(d); colors = palette(d);
      restart();
      layout();
      paint(performance.now());
      if (reduceMotion.matches || !animate) {
        // Still: the finished piece
        sewTo(list.length);
        paint(0);
      }
    };

    const kick = whileVisible(canvas, (t) => reduceMotion.matches ? false : frame(t));
    const replay = () => { if (design) { show(design); kick(); } };
    reduceMotion.addEventListener('change', () => {
      if (!design || !reduceMotion.matches) return;
      sewTo(list.length);
      paint(0);
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); paint(performance.now()); }).observe(canvas);
    return { show, kick, replay };
  };

  // ------------------------------------------------------------------ hero

  const heroCanvas = document.getElementById('hero-sew');
  if (heroCanvas) {
    const objectLabel = document.getElementById('hero-object');
    const countLabel = document.getElementById('hero-count');
    const sizeLabel = document.getElementById('hero-size');
    const fmt = new Intl.NumberFormat('en-US');
    let shownObject = -1;
    const sewer = sewingCanvas(heroCanvas, {
      rate: 620,
      padding: 0.04,
      onStitch: (n, o, design) => {
        countLabel.textContent = fmt.format(n);
        const total = design.objects.reduce((sum, item) => sum + item.stitches.length / 3, 0);
        const progress = document.getElementById('hero-progress');
        if (progress) progress.style.setProperty('--sewn', `${100 * n / total}%`);
        if (n === total) objectLabel.textContent = 'A little idea, stitched into life.';
        if (o !== shownObject && n < total) { shownObject = o; objectLabel.textContent = design.objects[o].name; }
      },
    });
    loadJson('assets/stitches/mark.json')
      .then((d) => {
        if (!validDesign(d)) throw new Error('Bad stitch data');
        sizeLabel.textContent = `${Math.round(d.w / 10)} × ${Math.round(d.h / 10)} mm`;
        heroCanvas.closest('.study-art')?.classList.add('canvas-ready');
        const replay = document.getElementById('hero-replay');
        if (replay) {
          replay.disabled = false;
          replay.addEventListener('click', () => { shownObject = -1; sewer.replay(); });
        }
        sewer.show(d);
        sewer.kick();
      })
      .catch(() => { /* the hoop simply stays empty */ });
  }

  // ---------------------------------------------------- download for you

  // The visitor's device picks the main download button and the first
  // download card. Unknown devices (iPhone, iPad, ChromeOS) keep the
  // button that scrolls to every platform.
  const detectOs = () => {
    const ua = navigator.userAgent || '';
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/android/i.test(ua) || /android/i.test(platform)) return 'android';
    if (/iphone|ipad|ipod|cros/i.test(ua)) return null;
    if (/mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) {
      // An iPad asks for desktop sites as a Mac, but only an iPad has a touch screen
      return navigator.maxTouchPoints > 1 ? null : 'macos';
    }
    if (/win/i.test(platform) || /windows nt/i.test(ua)) return 'windows';
    if (/linux|x11/i.test(platform) || /linux|x11/i.test(ua)) return 'linux';
    return null;
  };
  const yourOs = detectOs();
  const yourCard = yourOs && document.querySelector(`.platform[data-os="${yourOs}"]`);
  const yourLink = yourCard && yourCard.querySelector('.platform-get');
  if (yourCard && yourLink && /^https:\/\/github\.com\//.test(yourLink.href)) {
    const label = yourLink.textContent;
    for (const id of ['hero-get', 'closing-get']) {
      const b = document.getElementById(id);
      if (!b) continue;
      b.textContent = label;
      b.href = yourLink.href;
    }
    const other = document.getElementById('hero-other');
    if (other) other.hidden = false;
    const list = yourCard.parentElement;
    list.classList.add('has-yours');
    list.prepend(yourCard);
    yourCard.classList.add('is-yours');
    const pill = document.createElement('span');
    pill.className = 'platform-yours';
    pill.textContent = 'Your device';
    yourCard.insertBefore(pill, yourCard.firstChild);
  }

  // The Mac install steps open for Mac visitors and for links to #mac
  const macHelp = document.getElementById('mac');
  if (macHelp) {
    const openForLink = () => {
      if (location.hash === '#mac') macHelp.open = true;
    };
    if (yourOs === 'macos') macHelp.open = true;
    openForLink();
    window.addEventListener('hashchange', openForLink);
  }

  // --------------------------------------------------- picture to stitches

  // Real auto-digitize output: the stitches sew over the picture, the app's
  // own thread rendering takes over, then a slider compares the two.
  const picStage = document.getElementById('pic-stage');
  const picCanvas = document.getElementById('pic-sew');
  if (picStage && picCanvas) {
    const fmt = new Intl.NumberFormat('en-US');
    const steps = Array.from(picStage.querySelectorAll('.stage-steps span'));
    const range = document.getElementById('pic-range');
    const replay = document.getElementById('pic-replay');
    const setStep = (k) => steps.forEach((s, i) => s.classList.toggle('is-on', i === k));
    const setPos = (v) => picStage.style.setProperty('--pos', `${clamp(v, 0, 100)}%`);
    let design = null, total = 0, timers = [], sweep = 0, run = 0;

    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(sweep); };
    const after = (ms, fn) => timers.push(setTimeout(fn, ms));
    const showCompare = (animate) => {
      animate = animate && !reduceMotion.matches;
      picStage.classList.remove('is-sewing', 'is-thread');
      picStage.classList.add('is-done');
      setStep(3);
      if (!animate) { setPos(50); range.value = '50'; return; }
      // The divider sweeps in from the left, uncovering the picture
      const from = performance.now();
      const tick = (now) => {
        const t = clamp((now - from) / 1100, 0, 1);
        const v = 50 * easeInOut(t);
        setPos(v); range.value = String(Math.round(v));
        if (t < 1) sweep = requestAnimationFrame(tick);
      };
      setPos(0);
      sweep = requestAnimationFrame(tick);
    };

    const sewer = sewingCanvas(picCanvas, {
      rate: 1700,
      padding: 0,
      loop: false,
      onStitch: (n) => {
        if (n < total) return;
        const mine = run;
        after(500, () => { if (mine !== run) return; picStage.classList.add('is-thread'); setStep(2); });
        after(2300, () => { if (mine === run) showCompare(true); });
      },
    });

    const start = () => {
      if (!design) return;
      clearTimers();
      run++;
      if (reduceMotion.matches) { showCompare(false); return; }
      picStage.classList.remove('is-done', 'is-thread', 'is-sewing');
      setPos(0);
      setStep(0);
      const mine = run;
      after(900, () => {
        if (mine !== run) return;
        picStage.classList.add('is-sewing');
        setStep(1);
        sewer.show(design);
        sewer.kick();
      });
    };

    range.addEventListener('input', () => {
      cancelAnimationFrame(sweep);
      setPos(Number(range.value));
    });
    replay.addEventListener('click', start);
    reduceMotion.addEventListener('change', () => {
      if (!reduceMotion.matches) return;
      run++; clearTimers(); showCompare(false);
    });

    loadJson('assets/stitches/picture.json')
      .then((d) => {
        if (!validDesign(d)) throw new Error('Bad stitch data');
        design = d;
        total = d.objects.reduce((n, o) => n + o.stitches.length / 3, 0);
        // The studio's own counts (the compiled machine file) when given
        const shownStitches = isInt(d.stitchCount) && d.stitchCount > 0 ? d.stitchCount : total;
        const shownThreads = isInt(d.threadCount) && d.threadCount > 0 ? d.threadCount
          : new Set(d.objects.map((o) => o.color.toLowerCase())).size;
        document.getElementById('pic-objects').textContent = fmt.format(d.objects.length);
        document.getElementById('pic-stitches').textContent = fmt.format(shownStitches);
        document.getElementById('pic-threads').textContent = fmt.format(shownThreads);
        showCompare(false);
      })
      .catch(() => showCompare(false));
  }

  // --------------------------------------------------------------- lettering

  const letterCanvas = document.getElementById('lettering-sew');
  const fontGroup = document.getElementById('lettering-fonts');
  if (letterCanvas && fontGroup) {
    const note = document.getElementById('lettering-note');
    const fmt = new Intl.NumberFormat('en-US');
    const sewer = sewingCanvas(letterCanvas, { rate: 700, padding: 0.08 });
    document.getElementById('lettering-replay')?.addEventListener('click', () => sewer.replay());
    loadJson('assets/stitches/lettering.json')
      .then((list) => {
        if (!Array.isArray(list) || list.length > 8) throw new Error('Bad lettering data');
        const words = list.filter((d) => validDesign(d) && typeof d.font === 'string' && d.font.length <= 40 &&
          typeof d.text === 'string' && d.text.length <= 40);
        if (!words.length) return;
        const buttons = words.map((d, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('role', 'radio');
          b.textContent = d.font;
          b.addEventListener('click', () => choose(i, false));
          b.addEventListener('keydown', (e) => {
            const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            choose((i + step + words.length) % words.length, true);
          });
          fontGroup.appendChild(b);
          return b;
        });
        const choose = (k, focus, animate = true) => {
          buttons.forEach((b, i) => { b.setAttribute('aria-checked', String(i === k)); b.tabIndex = i === k ? 0 : -1; });
          if (focus) buttons[k].focus();
          const d = words[k];
          const n = isInt(d.stitchCount) && d.stitchCount > 0 ? d.stitchCount : d.objects.reduce((a, o) => a + o.stitches.length / 3, 0);
          note.textContent = `“${d.text}” in ${d.font}: ${fmt.format(n)} stitches of satin.`;
          letterCanvas.setAttribute('aria-label', `“${d.text}” being sewn in satin lettering in ${d.font}`);
          sewer.show(d, { animate });
          sewer.kick();
        };
        choose(0, false, false);
      })
      .catch(() => { /* the stage stays empty */ });
  }

  // --------------------------------------------------------- machine picker

  // Same groups and limits as the app's EmbroideryMachine list
  const pick = document.getElementById('machine-pick');
  if (pick) {
    const buttons = Array.from(pick.querySelectorAll('button'));
    const out = {
      field: document.getElementById('spec-field'),
      trims: document.getElementById('spec-trims'),
      stitches: document.getElementById('spec-stitches'),
      colors: document.getElementById('spec-colors'),
    };
    const set = (el, text) => {
      if (el.textContent === text) return;
      el.textContent = text;
      el.classList.remove('is-changed');
      void el.offsetWidth;
      el.classList.add('is-changed');
    };
    const choose = (b, focus) => {
      buttons.forEach((x) => {
        const on = x === b;
        x.setAttribute('aria-checked', String(on));
        x.tabIndex = on ? 0 : -1;
      });
      if (focus) b.focus();
      const [stitches, colors] = (b.dataset.limits || '').split('|');
      set(out.field, b.dataset.field || '');
      set(out.trims, b.dataset.trims === 'yes' ? 'Machine trims' : 'Trim by hand');
      set(out.stitches, stitches || 'Per its manual');
      set(out.colors, b.dataset.multi === 'yes' ? 'No stops, 6 needles' : colors || 'Per its manual');
    };
    buttons.forEach((b, i) => {
      b.addEventListener('click', () => choose(b, false));
      b.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        choose(buttons[(i + step + buttons.length) % buttons.length], true);
      });
    });
  }

  // --------------------------------------------------------- stitch library

  const ABOUT = {
    'Tatami fill': ['Rows of even stitches that cover large areas flat. Needle drops shift row to row, so no seam lines up, and the needle travels under fabric it has not covered yet.', '0.4 mm'],
    'Satin column': ['Glossy zigzag stitches across a column. Pull compensation widens it so it sews at the width you drew, and underlay is picked from its width.', '0.2 mm'],
    'Contour fill': ['Rings that follow the shape inward. Each ring starts somewhere new, so the joins scatter instead of lining up into a seam.', '0.4 mm'],
    'Radial fill': ['Rows that radiate from a center you choose. Toward the middle every other row stops, so the center never piles up.', '0.4 mm'],
    'Stipple fill': ['One meandering line that never crosses itself, for quilting textures and light coverage.', '2.5 mm'],
    'Blanket stitch': ['The classic edge stitch. Spokes stop at a corner\'s bisector and never cross, with a diagonal spoke on every sharp corner.', '3 mm'],
  };

  const libCanvas = document.getElementById('library-sew');
  const tabs = Array.from(document.querySelectorAll('#stitch-tabs [role="tab"]'));
  if (libCanvas && tabs.length) {
    const nameEl = document.getElementById('library-name');
    const aboutEl = document.getElementById('library-about');
    const countEl = document.getElementById('library-count');
    const sizeEl = document.getElementById('library-size');
    const spacingEl = document.getElementById('library-spacing');
    const panel = document.getElementById('stitch-panel');
    const fmt = new Intl.NumberFormat('en-US');
    let samples = [];
    const sewer = sewingCanvas(libCanvas, { rate: 600, padding: 0.08 });
    document.getElementById('library-replay')?.addEventListener('click', () => sewer.replay());

    const select = (index, focus, animate = true) => {
      tabs.forEach((t, i) => {
        const on = i === index;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tabs[index].focus();
      panel.setAttribute('aria-labelledby', tabs[index].id);
      const s = samples[index];
      if (!s) return;
      nameEl.textContent = s.name;
      const about = ABOUT[s.name];
      if (about) { aboutEl.textContent = about[0]; spacingEl.textContent = about[1]; }
      countEl.textContent = fmt.format(s.stitches.length / 3);
      sizeEl.textContent = `${Math.round((s.w - 40) / 10)} × ${Math.round((s.h - 40) / 10)} mm`;
      libCanvas.setAttribute('aria-label', `${s.name} being sewn`);
      sewer.show({ w: s.w, h: s.h, objects: [s] }, { animate });
      sewer.kick();
    };

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i, false));
      t.addEventListener('keydown', (e) => {
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select((next + tabs.length) % tabs.length, true);
      });
    });

    loadJson('assets/stitches/samples.json')
      .then((list) => {
        if (!Array.isArray(list) || list.length > 32) throw new Error('Bad sample data');
        samples = list.filter((s) => validObject(s) && isInt(s.w) && isInt(s.h) && s.w > 0 && s.h > 0);
        select(0, false, false);
      })
      .catch(() => {});
  }

  // ----------------------------------------------------------- screen clips

  // Real recordings of the studio on a tablet. A clip plays once when most of
  // it is on screen (muted, no loop), pauses while it is off screen, and ends
  // on the finished design with a replay button. With reduced motion it
  // stays on its poster (the finished design) until the visitor presses play.
  document.querySelectorAll('.clip').forEach((clip) => {
    const video = clip.querySelector('video');
    const button = clip.querySelector('.clip-button');
    const icon = button && button.querySelector('.clip-icon');
    const label = button && button.querySelector('.clip-label');
    if (!video || !icon || !label) return;
    video.muted = true;
    let started = false, onScreen = false, heldOffscreen = false;
    const offer = (play) => {
      icon.textContent = play ? '▶' : '↻';
      label.textContent = play ? 'Play' : 'Replay';
      button.hidden = false;
    };
    const play = () => {
      started = true;
      button.hidden = true;
      video.play().catch(() => offer(true));
    };
    video.addEventListener('ended', () => offer(false));
    button.addEventListener('click', () => {
      if (video.ended) video.currentTime = 0;
      play();
    });
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches && !video.paused) { video.pause(); offer(true); }
    });
    if (reduceMotion.matches || !('IntersectionObserver' in window)) { offer(true); return; }
    new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (reduceMotion.matches) return;
      if (onScreen && !started) play();
      else if (onScreen && heldOffscreen) { heldOffscreen = false; video.play().catch(() => offer(true)); }
      else if (!onScreen && !video.paused) { heldOffscreen = true; video.pause(); }
    }, { threshold: 0.5 }).observe(clip);
  });

  // ------------------------------------------------------------ mobile menu

  const menuButton = document.getElementById('menu-button');
  const menu = document.getElementById('site-menu');
  if (menuButton && menu) {
    const setOpen = (open) => {
      menuButton.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
    };
    menuButton.addEventListener('click', () => setOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); menuButton.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (menu.classList.contains('is-open') && !menu.contains(e.target) && !menuButton.contains(e.target)) setOpen(false);
    });
  }

  // ----------------------------------------------------------- corner style

  const cornerCanvas = document.getElementById('corner-sew');
  const cornerGroup = document.getElementById('corner-style');
  if (cornerCanvas && cornerGroup) {
    const radios = Array.from(cornerGroup.querySelectorAll('[role="radio"]'));
    const note = document.getElementById('corner-note');
    const NOTES = {
      miter: 'Mitre: both legs stay square and meet on a seam from the inner corner to a sharp point.',
      radiate: 'Radiate: stitches fan around turns up to 60 degrees for a rounded outer edge. Sharper corners are mitred anyway.',
    };
    const sewer = sewingCanvas(cornerCanvas, { rate: 260, padding: 0.06, hold: 2400 });
    let designs = null;
    const choose = (style, focus, animate = true) => {
      radios.forEach((r) => {
        const on = r.dataset.style === style;
        r.setAttribute('aria-checked', String(on));
        r.tabIndex = on ? 0 : -1;
        if (on && focus) r.focus();
      });
      note.textContent = NOTES[style] || '';
      cornerCanvas.setAttribute('aria-label', `A satin zigzag sewn with ${style === 'miter' ? 'mitred' : 'radiating'} corners`);
      if (designs && designs[style]) { sewer.show(designs[style], { animate }); sewer.kick(); }
    };
    radios.forEach((r, i) => {
      r.addEventListener('click', () => choose(r.dataset.style, false));
      r.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        choose(radios[(i + step + radios.length) % radios.length].dataset.style, true);
      });
    });
    loadJson('assets/stitches/corners.json')
      .then((d) => {
        if (!d || !validDesign(d.miter) || !validDesign(d.radiate)) throw new Error('Bad corner data');
        designs = { miter: d.miter, radiate: d.radiate };
        choose('miter', false, false);
      })
      .catch(() => {});
  }

  // --------------------------------------------------------- thread build-up

  // Layers of thread per square millimetre, as the studio's build-up map
  // counts them: each stitch's length shared among the 1 mm cells it
  // crosses, 2.5 mm of thread per mm² being one layer, averaged with the
  // four neighbouring cells
  const buildCanvas = document.getElementById('buildup');
  const buildToggle = document.getElementById('buildup-toggle');
  if (buildCanvas && buildToggle) {
    let design = null, list = [], colors = [], layers = null, cols = 0, rows = 0;
    let shown = true, alpha = 1, target = 1, fadeFrom = 0, fadeStart = 0;

    const measure = () => {
      cols = Math.ceil(design.w / 10) + 1; rows = Math.ceil(design.h / 10) + 1;
      const thread = new Float32Array(cols * rows);
      for (let i = 1; i < list.length; i++) {
        const p = list[i], q = list[i - 1];
        if (p.t === 2 || q.o !== p.o) continue;
        const len = Math.hypot(p.x - q.x, p.y - q.y);
        if (!len) continue;
        const steps = Math.max(1, Math.ceil(len / 2));
        for (let k = 0; k < steps; k++) {
          const t = (k + 0.5) / steps;
          const c = Math.floor((q.x + (p.x - q.x) * t) / 10), r = Math.floor((q.y + (p.y - q.y) * t) / 10);
          if (c >= 0 && r >= 0 && c < cols && r < rows) thread[r * cols + c] += len / 10 / steps;
        }
      }
      layers = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let sum = thread[r * cols + c] * 4, weight = 4;
          for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const cc = c + dc, rr = r + dr;
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
            sum += thread[rr * cols + cc]; weight += 1;
          }
          layers[r * cols + c] = sum / weight / 2.5;
        }
      }
    };

    const heat = (v) => (v < 3 ? null : v < 4 ? [245, 194, 66, 0.55] : v < 5 ? [240, 134, 46, 0.63] : [229, 56, 59, 0.7]);

    const draw = (now) => {
      if (!design) return;
      if (alpha !== target) {
        const k = clamp((now - fadeStart) / 320, 0, 1);
        alpha = fadeFrom + (target - fadeFrom) * k;
      }
      const { w, h, ctx } = fitCanvas(buildCanvas);
      ctx.clearRect(0, 0, w, h);
      const pad = Math.min(w, h) * 0.05;
      const scale = Math.min((w - 2 * pad) / design.w, (h - 2 * pad) / design.h);
      const ox = (w - design.w * scale) / 2, oy = (h - design.h * scale) / 2;
      const tw = clamp(4.2 * scale, 0.8, 3);
      for (let i = 1; i < list.length; i++) drawStitch(ctx, list, i, colors, scale, ox, oy, tw);
      if (alpha > 0.001) {
        const cell = 10 * scale;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const col = heat(layers[r * cols + c]);
            if (!col) continue;
            ctx.fillStyle = css(col, col[3] * alpha);
            ctx.fillRect(ox + c * cell, oy + r * cell, Math.ceil(cell), Math.ceil(cell));
          }
        }
      }
    };

    let animating = false;
    const run = (now) => {
      draw(now);
      if (alpha !== target) requestAnimationFrame(run);
      else animating = false;
    };
    buildToggle.addEventListener('click', () => {
      shown = !shown;
      buildToggle.setAttribute('aria-pressed', String(shown));
      buildToggle.textContent = shown ? 'Hide the map' : 'Show the map';
      fadeFrom = alpha; target = shown ? 1 : 0; fadeStart = performance.now();
      if (reduceMotion.matches) { alpha = target; draw(0); return; }
      if (!animating) { animating = true; requestAnimationFrame(run); }
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => draw(performance.now())).observe(buildCanvas);
    loadJson('assets/stitches/patch.json')
      .then((d) => {
        if (!validDesign(d)) throw new Error('Bad patch data');
        design = d; list = flatten(d); colors = palette(d);
        measure();
        draw(performance.now());
      })
      .catch(() => {});
  }

  // ------------------------------------------------------------ design check
  const check = document.querySelector('.check-demo');
  if (check) {
    const items = Array.from(check.querySelectorAll('.check-item'));
    const button = document.getElementById('check-all');
    let fixed = false, timers = [];
    button.addEventListener('click', () => {
      timers.forEach(clearTimeout); timers = [];
      fixed = !fixed;
      button.textContent = fixed ? 'Reset example' : 'Run example check';
      check.classList.remove('is-clear');
      items.forEach((item, i) => {
        item.classList.remove('is-fixed');
        if (fixed) {
          if (reduceMotion.matches) item.classList.add('is-fixed');
          else timers.push(setTimeout(() => item.classList.add('is-fixed'), i * 180 + 120));
        }
      });
      if (fixed) {
        if (reduceMotion.matches) check.classList.add('is-clear');
        else timers.push(setTimeout(() => check.classList.add('is-clear'), items.length * 180 + 180));
      }
    });
  }
})();
