(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;

  /* ---------------------------------------------------------
     Safe storage (works even when localStorage is blocked)
     --------------------------------------------------------- */
  const mem = {};
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('pansion:' + key);
        return raw === null ? (key in mem ? mem[key] : fallback) : JSON.parse(raw);
      } catch { return key in mem ? mem[key] : fallback; }
    },
    set(key, value) {
      mem[key] = value;
      try { localStorage.setItem('pansion:' + key, JSON.stringify(value)); return true; }
      catch { return false; }
    },
    remove(key) {
      delete mem[key];
      try { localStorage.removeItem('pansion:' + key); } catch { /* ignore */ }
    },
  };

  /* ---------------------------------------------------------
     Formatting helpers (Persian digits)
     --------------------------------------------------------- */
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const toFa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
  const pad2 = (n) => String(n).padStart(2, '0');
  const clock = (sec, forceHours = false) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return toFa((h > 0 || forceHours) ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`);
  };
  const human = (sec) => {
    if (sec < 60) return `${toFa(sec)} ثانیه`;
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (h === 0) return `${toFa(m)} دقیقه`;
    return m === 0 ? `${toFa(h)} ساعت` : `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
  };
  const dateFmt = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateTimeFmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const weekdayFmt = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' });
  const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const DAY = 86400000;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------------------------------------------------------
     Toast
     --------------------------------------------------------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  /* ---------------------------------------------------------
     Theme: mode (light | dark | system) × accent
     --------------------------------------------------------- */
  const MODES = ['light', 'dark', 'system'];
  const ACCENTS = ['amber', 'blue', 'green', 'violet', 'rose'];
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  let theme = { mode: 'dark', accent: 'amber' };
  { const saved = store.get('theme', {});
    if (MODES.includes(saved.mode)) theme.mode = saved.mode;
    if (ACCENTS.includes(saved.accent)) theme.accent = saved.accent; }

  const resolvedMode = () => (theme.mode === 'system' ? (mq.matches ? 'dark' : 'light') : theme.mode);

  function applyTheme(save = true) {
    root.dataset.mode = resolvedMode();
    root.dataset.accent = theme.accent;
    $$('[data-mode].seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === theme.mode)));
    $$('[data-accent].accent-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === theme.accent)));
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#0b1220');
    if (save) store.set('theme', theme);
  }
  $$('.seg-btn').forEach((b) => b.addEventListener('click', () => { theme.mode = b.dataset.mode; applyTheme(); }));
  $$('.accent-btn').forEach((b) => b.addEventListener('click', () => { theme.accent = b.dataset.accent; applyTheme(); }));
  $('#quickTheme').addEventListener('click', () => { theme.mode = resolvedMode() === 'dark' ? 'light' : 'dark'; applyTheme(); });
  (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => { if (theme.mode === 'system') applyTheme(false); });

  /* ---------------------------------------------------------
     Data: sessions + groups
     --------------------------------------------------------- */
  const MIN_SESSION_SEC = 10;
  let sessions = store.get('sessions', []);
  if (!Array.isArray(sessions)) sessions = [];
  sessions = sessions.filter((s) => s && Number.isFinite(s.sec) && Number.isFinite(s.end));
  let groups = store.get('groups', []);
  if (!Array.isArray(groups)) groups = [];
  groups = groups.filter((g) => g && typeof g.name === 'string');
  // groups saved by the old version had no id/created
  groups.forEach((g) => { if (!g.id) g.id = uid(); if (!g.created) g.created = Date.now(); });

  const sumSec = (list) => list.reduce((a, s) => a + s.sec, 0);
  const sessionsOn = (ms) => sessions.filter((s) => dayKey(s.end) === dayKey(ms));

  /* ---------------------------------------------------------
     Timer (survives reloads; based on wall-clock time)
     --------------------------------------------------------- */
  const GOALS = [0, 25, 45, 60];
  let t = Object.assign({ goal: 25, status: 'idle', base: 0, startedAt: 0, notified: false }, store.get('timer', {}));
  if (!GOALS.includes(t.goal)) t.goal = 25;
  if (!['idle', 'running', 'paused'].includes(t.status)) t.status = 'idle';
  if (!Number.isFinite(t.base) || t.base < 0) t.base = 0;
  if (t.status === 'running' && !Number.isFinite(t.startedAt)) { t.status = 'paused'; }

  const persistTimer = () => store.set('timer', t);
  const elapsed = () => (t.status === 'running' ? t.base + Math.max(0, Math.floor((Date.now() - t.startedAt) / 1000)) : t.base);
  const RING_C = 2 * Math.PI * 88;
  let tickHandle = null;
  let lastShown = -1;

  function startTimer() {
    if (t.status === 'running') return;
    t.status = 'running';
    t.startedAt = Date.now();
    persistTimer();
    ensureTick();
    renderTimer(true);
  }
  function pauseTimer() {
    if (t.status !== 'running') return;
    t.base = elapsed();
    t.status = 'paused';
    t.startedAt = 0;
    persistTimer();
    renderTimer(true);
  }
  function finishTimer() {
    const sec = elapsed();
    if (sec >= MIN_SESSION_SEC) {
      sessions.push({ id: uid(), end: Date.now(), sec, goal: t.goal });
      if (sessions.length > 1000) sessions = sessions.slice(-1000);
      store.set('sessions', sessions);
      toast(`جلسه‌ی ${human(sec)} ثبت شد.`);
    } else if (sec > 0) {
      toast(`جلسه‌های کمتر از ${toFa(MIN_SESSION_SEC)} ثانیه ثبت نمی‌شوند.`);
    }
    t.status = 'idle'; t.base = 0; t.startedAt = 0; t.notified = false;
    persistTimer();
    renderTimer(true);
    renderData();
  }
  function setGoal(minutes) {
    t.goal = minutes;
    t.notified = elapsed() >= minutes * 60 && minutes > 0; // do not announce a goal that is already behind us
    persistTimer();
    renderTimer(true);
  }
  function ensureTick() {
    if (tickHandle || t.status !== 'running') return;
    tickHandle = setInterval(() => {
      if (t.status !== 'running') { clearInterval(tickHandle); tickHandle = null; return; }
      renderTimer(false);
    }, 250);
  }

  const timerRoots = $$('[data-timer]');
  function goalText() {
    return t.goal === 0 ? 'بدون هدف · حلقه هر ۶۰ دقیقه کامل می‌شود' : `هدف: ${toFa(t.goal)} دقیقه`;
  }
  function renderTimer(force) {
    const sec = elapsed();
    if (!force && sec === lastShown) return;
    lastShown = sec;

    const goalSec = (t.goal || 60) * 60;
    const progress = Math.min(1, (t.goal ? sec : sec % goalSec) / goalSec);
    const reached = t.goal > 0 && sec >= goalSec;
    const stateLabel = t.status === 'running' ? (reached ? 'هدف کامل شد' : 'در حال تمرکز')
      : t.status === 'paused' ? 'مکث شده' : 'آماده‌ی شروع';

    timerRoots.forEach((r) => {
      $$('[data-t="time"]', r).forEach((e) => { e.textContent = clock(sec); });
      $$('[data-t="state"]', r).forEach((e) => { e.textContent = stateLabel; });
      $$('[data-t="goalText"]', r).forEach((e) => { e.textContent = goalText(); });
      $$('[data-t="startLabel"]', r).forEach((e) => { e.textContent = t.status === 'paused' ? 'ادامه' : 'شروع جلسه'; });
      $$('[data-t="ring"]', r).forEach((e) => { e.setAttribute('stroke-dashoffset', (RING_C * (1 - progress)).toFixed(2)); });
      $$('[data-t="live"]', r).forEach((e) => e.classList.toggle('on', t.status === 'running'));
      $$('[data-act="start"]', r).forEach((b) => { b.disabled = t.status === 'running'; });
      $$('[data-act="pause"]', r).forEach((b) => { b.disabled = t.status !== 'running'; });
      $$('[data-act="finish"]', r).forEach((b) => { b.disabled = t.status === 'idle' && sec === 0; });
    });
    $$('[data-goal]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.goal) === t.goal)));

    if (t.status === 'running' && reached && !t.notified) {
      t.notified = true; persistTimer();
      toast(`هدف ${toFa(t.goal)} دقیقه‌ای کامل شد. آفرین!`);
    }
    document.title = t.status === 'running' ? `${clock(sec)} · پانسیون` : pageTitleText();
    renderLiveMetrics();
  }

  timerRoots.forEach((r) => r.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) { ({ start: startTimer, pause: pauseTimer, finish: finishTimer })[btn.dataset.act](); return; }
    const goal = e.target.closest('[data-goal]');
    if (goal) setGoal(Number(goal.dataset.goal));
  }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderTimer(true); });

  /* ---------------------------------------------------------
     Metrics / lists / chart
     --------------------------------------------------------- */
  const setM = (name, text) => $$(`[data-m="${name}"]`).forEach((e) => { e.textContent = text; });

  function renderLiveMetrics() {
    const todaySaved = sumSec(sessionsOn(Date.now()));
    setM('todayTotal', clock(todaySaved + elapsed(), true));
  }

  function streakDays() {
    const days = new Set(sessions.map((s) => dayKey(s.end)));
    let cursor = startOfDay(Date.now());
    if (!days.has(dayKey(cursor))) cursor -= DAY; // today may still be empty
    let n = 0;
    while (days.has(dayKey(cursor))) { n += 1; cursor -= DAY; }
    return n;
  }

  function sessionItem(s) {
    const li = document.createElement('li');
    const info = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = human(s.sec);
    const small = document.createElement('small');
    small.textContent = dateTimeFmt.format(new Date(s.end));
    info.append(strong, document.createElement('br'), small);
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = s.goal ? `هدف ${toFa(s.goal)} دقیقه` : 'بدون هدف';
    li.append(info, badge);
    return li;
  }
  function fillSessions(listEl, emptyEl, count) {
    const recent = sessions.slice(-count).reverse();
    listEl.replaceChildren(...recent.map(sessionItem));
    listEl.hidden = recent.length === 0;
    emptyEl.hidden = recent.length > 0;
  }

  function renderChart() {
    const svg = $('#weekChart');
    const W = 700, H = 240, top = 28, bottom = 36, left = 20, right = 20;
    const today = startOfDay(Date.now());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const ms = today - i * DAY;
      days.push({ ms, sec: sumSec(sessionsOn(ms)) });
    }
    const total = days.reduce((a, d) => a + d.sec, 0);
    $('#chartBox').hidden = total === 0;
    $('#chartEmpty').hidden = total > 0;
    setM('weekTotal', total ? `مجموع: ${human(total)}` : '');
    if (total === 0) { svg.replaceChildren(); return; }

    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs, text) => {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      if (text !== undefined) el.textContent = text;
      return el;
    };
    const max = Math.max(...days.map((d) => d.sec));
    const plotH = H - top - bottom;
    const slot = (W - left - right) / 7;
    const barW = Math.min(46, slot * 0.58);
    const nodes = [mk('line', { class: 'grid', x1: left, x2: W - right, y1: H - bottom, y2: H - bottom })];
    days.forEach((d, i) => {
      // RTL: oldest day on the right, today on the left
      const cx = W - right - slot * (i + 0.5);
      const h = d.sec ? Math.max(4, (d.sec / max) * plotH) : 0;
      if (h) {
        nodes.push(mk('rect', { class: i === 6 ? 'bar today' : 'bar', x: (cx - barW / 2).toFixed(1), y: (H - bottom - h).toFixed(1), width: barW.toFixed(1), height: h.toFixed(1), rx: 6 }));
        nodes.push(mk('text', { class: 'val', x: cx.toFixed(1), y: (H - bottom - h - 8).toFixed(1) }, toFa(Math.round(d.sec / 60)) + 'د'));
      }
      nodes.push(mk('text', { x: cx.toFixed(1), y: H - 12 }, i === 6 ? 'امروز' : weekdayFmt.format(new Date(d.ms))));
    });
    svg.replaceChildren(...nodes);
    svg.setAttribute('aria-label', 'مطالعه‌ی ۷ روز گذشته (دقیقه): ' + days.map((d) => `${weekdayFmt.format(new Date(d.ms))} ${toFa(Math.round(d.sec / 60))}`).join('، '));
  }

  function renderData() {
    const todays = sessionsOn(Date.now());
    setM('todaySessions', toFa(todays.length));
    setM('todayNote', todays.length || elapsed() ? 'شامل جلسه‌ی جاری' : 'هنوز جلسه‌ای ثبت نشده');
    setM('groupCount', toFa(groups.length));
    renderLiveMetrics();

    const all = sumSec(sessions);
    setM('allTotal', clock(all, true));
    setM('sessionCount', toFa(sessions.length));
    setM('avg', sessions.length ? human(Math.round(all / sessions.length)) : '—');
    setM('streak', toFa(streakDays()));

    fillSessions($('#homeSessions'), $('#homeSessionsEmpty'), 5);
    fillSessions($('#statsSessions'), $('#statsSessionsEmpty'), 10);
    renderChart();
    renderGroups();
  }

  /* ---------------------------------------------------------
     Groups
     --------------------------------------------------------- */
  const accessLabel = (a) => (a === 'public' ? 'عمومی · محلی' : 'خصوصی · محلی');
  let pendingDeleteId = null;
  let pendingDeleteTimer;

  function renderGroups() {
    const list = $('#groupsList');
    list.replaceChildren(...groups.map((g) => {
      const li = document.createElement('li');
      li.className = 'group-item';
      const info = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = g.name;
      const small = document.createElement('small');
      small.textContent = 'ساخته‌شده در همین مرورگر · ' + new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(new Date(g.created));
      info.append(name, small);
      const meta = document.createElement('div');
      meta.className = 'group-meta';
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = accessLabel(g.access);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn';
      del.dataset.del = g.id;
      const confirming = pendingDeleteId === g.id;
      del.setAttribute('aria-label', (confirming ? 'تأیید حذف گروه ' : 'حذف گروه ') + g.name);
      del.title = confirming ? 'برای تأیید دوباره بزن' : 'حذف گروه';
      del.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-trash"/></svg>';
      if (confirming) del.classList.add('armed');
      meta.append(badge, del);
      li.append(info, meta);
      return li;
    }));
    list.hidden = groups.length === 0;
    $('#groupsEmpty').hidden = groups.length > 0;

    const mini = $('#homeGroups');
    mini.replaceChildren(...groups.slice(-4).reverse().map((g) => {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.textContent = g.name;
      const b = document.createElement('span'); b.className = 'badge'; b.textContent = accessLabel(g.access);
      li.append(n, b);
      return li;
    }));
    mini.hidden = groups.length === 0;
    $('#homeGroupsEmpty').hidden = groups.length > 0;
    setM('groupCount', toFa(groups.length));
  }

  $('#groupsList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    const id = btn.dataset.del;
    if (pendingDeleteId === id) {
      groups = groups.filter((g) => g.id !== id);
      store.set('groups', groups);
      pendingDeleteId = null;
      clearTimeout(pendingDeleteTimer);
      renderGroups();
      toast('گروه حذف شد.');
    } else {
      pendingDeleteId = id;
      renderGroups();
      $(`[data-del="${id}"]`)?.focus();
      clearTimeout(pendingDeleteTimer);
      pendingDeleteTimer = setTimeout(() => { pendingDeleteId = null; renderGroups(); }, 3500);
      toast('برای حذف، دوباره روی آیکن سطل بزن.');
    }
  });

  /* ---------- Create-group dialog ---------- */
  const dlg = $('#groupDialog');
  const form = $('#groupForm');
  const nameInput = $('#groupName');
  const errorEl = $('#groupError');
  let opener = null;

  function openDialog(fromEl) {
    opener = fromEl || document.activeElement;
    form.reset();
    errorEl.hidden = true; nameInput.removeAttribute('aria-invalid');
    closeNav();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    nameInput.focus();
  }
  function closeDialog() {
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
    if (opener && document.contains(opener)) opener.focus();
  }
  $$('[data-open-group]').forEach((b) => b.addEventListener('click', () => openDialog(b)));
  $('#closeDialog').addEventListener('click', closeDialog);
  $('#cancelDialog').addEventListener('click', closeDialog);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(); }); // backdrop click

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.replace(/\s+/g, ' ').trim();
    let err = '';
    if (!name) err = 'نام گروه را وارد کن.';
    else if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) err = 'گروهی با این نام از قبل ساخته‌ای.';
    if (err) {
      errorEl.textContent = err; errorEl.hidden = false;
      nameInput.setAttribute('aria-invalid', 'true'); nameInput.focus();
      return;
    }
    groups.push({ id: uid(), name, access: $('#groupAccess').value === 'public' ? 'public' : 'private', created: Date.now() });
    store.set('groups', groups);
    opener = null;
    closeDialog();
    renderData();
    location.hash = '#/groups';
    toast('گروه در همین مرورگر ایجاد شد.');
  });
  nameInput.addEventListener('input', () => { errorEl.hidden = true; nameInput.removeAttribute('aria-invalid'); });

  /* ---------------------------------------------------------
     Settings: export / clear
     --------------------------------------------------------- */
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), theme, groups, sessions }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pansion-backup.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('فایل پشتیبان آماده شد.');
  });

  const clearBtn = $('#clearBtn');
  let clearArmed = false, clearTimer;
  clearBtn.addEventListener('click', () => {
    if (!clearArmed) {
      clearArmed = true;
      clearBtn.classList.add('confirm');
      $('span', clearBtn).textContent = 'مطمئنی؟ دوباره بزن';
      clearTimer = setTimeout(disarmClear, 4000);
      return;
    }
    disarmClear();
    groups = []; sessions = [];
    store.remove('groups'); store.remove('sessions');
    t = { goal: t.goal, status: 'idle', base: 0, startedAt: 0, notified: false };
    persistTimer();
    renderTimer(true); renderData();
    toast('همه‌ی داده‌ها پاک شد.');
  });
  function disarmClear() {
    clearArmed = false; clearTimeout(clearTimer);
    clearBtn.classList.remove('confirm');
    $('span', clearBtn).textContent = 'پاک‌کردن همه‌ی داده‌ها';
  }

  /* ---------------------------------------------------------
     Router (hash based: #/home #/groups #/focus #/stats #/settings)
     --------------------------------------------------------- */
  const PAGES = { home: 'نمای کلی', groups: 'گروه‌های من', focus: 'تمرکز', stats: 'آمار مطالعه', settings: 'تنظیمات' };
  let currentPage = 'home';
  const pageTitleText = () => `${PAGES[currentPage]} · پانسیون`;

  function route(initial = false) {
    const key = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'home';
    const page = Object.prototype.hasOwnProperty.call(PAGES, key) ? key : 'home';
    if (page !== key || !location.hash) history.replaceState(null, '', '#/' + page);
    currentPage = page;
    $$('.page').forEach((p) => { p.hidden = p.id !== 'page-' + page; });
    $$('.nav-link').forEach((a) => {
      if (a.dataset.page === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#pageTitle').textContent = PAGES[page];
    document.title = t.status === 'running' ? `${clock(elapsed())} · پانسیون` : pageTitleText();
    closeNav();
    if (!initial) {
      window.scrollTo(0, 0);
      $('h1', $('#page-' + page))?.focus({ preventScroll: true });
    }
  }
  window.addEventListener('hashchange', () => route());

  /* ---------------------------------------------------------
     Mobile drawer
     --------------------------------------------------------- */
  const menuBtn = $('#menuBtn'), scrim = $('#scrim');
  function openNav() {
    document.body.classList.add('nav-open');
    scrim.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-label', 'بستن منو');
    $('.nav-link[aria-current="page"]')?.focus();
  }
  function closeNav(returnFocus = false) {
    if (!document.body.classList.contains('nav-open')) return;
    document.body.classList.remove('nav-open');
    scrim.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'باز کردن منو');
    if (returnFocus) menuBtn.focus();
  }
  menuBtn.addEventListener('click', () => (document.body.classList.contains('nav-open') ? closeNav(true) : openNav()));
  scrim.addEventListener('click', () => closeNav(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(true); });
  window.matchMedia('(min-width: 861px)').addEventListener?.('change', (e) => { if (e.matches) closeNav(); });

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  $('#today').textContent = dateFmt.format(new Date());
  applyTheme(false);
  route(true);
  renderData();
  renderTimer(true);
  ensureTick();
})();
