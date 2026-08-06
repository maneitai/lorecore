/* LoreCore — shell.
   Binder fire moduser sammen. State i localStorage, DOM er statisk,
   moduser kjører innerHTML-rewrites mot faste containere. */

import * as library from './modes/library.js';
import * as author  from './modes/author.js';
import * as qc      from './modes/qc.js';
import * as kilder  from './modes/kilder.js';
import { store }    from './store.js';

const MODES = { library, author, qc, kilder };
const LS_MODE = 'lorecore.mode';
const LS_BOOK = 'lorecore.bookId';
const LS_LIB  = 'lorecore.libraryId';

const rail     = document.getElementById('rail');
const main     = document.getElementById('main');
const ctx      = document.getElementById('ctx');
const longrun  = document.querySelector('.longrun');
const modeBtns = document.querySelectorAll('.mode');
const uniEl    = document.querySelector('.uni b');

function deriveLabel(pid) {
  const parts = pid.split('-');
  return parts[parts.length - 1] || 'V1';
}

const app = {
  state: {
    sel: {
      library: { kind: 'author', pid: 'none' },
      author:  { sessionPid: null },
      qc:      { pid: null },
      kilder:  { pid: null },
    },
    bookPid:      localStorage.getItem(LS_BOOK) || 'LBK-GALDV2-B1-V31A',
    versionLabel: null,
    libraryPid:   localStorage.getItem(LS_LIB)  || 'LIB-GALDURDAL-B1-V2',
    universeId:   'UNI-GALDURDAL',
    _mode:        localStorage.getItem(LS_MODE) || 'library',
  },
  els: { rail, main, ctx, longrun },
};

app.paintTop = function paintTop() {
  modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === app.state._mode));
  if (uniEl) uniEl.textContent = app.state.universeId;
};

app.go = function go(mode, sel) {
  if (!MODES[mode]) return;
  if (sel) Object.assign(app.state.sel[mode], sel);
  app.state._mode = mode;
  localStorage.setItem(LS_MODE, mode);
  document.body.dataset.mode = mode;
  app.paintTop();
  rail.classList.remove('open');
  ctx.classList.remove('open');
  MODES[mode].render(app);
};

app.setBook = function setBook(pid, label) {
  app.state.bookPid      = pid;
  app.state.versionLabel = label || deriveLabel(pid);
  localStorage.setItem(LS_BOOK, pid);
  app.paintTop();
};

app.refreshRuns = async function refreshRuns() {
  try {
    const runs = await store.activeRuns();
    if (runs && runs.length > 0) {
      const r = runs[0];
      longrun.hidden = false;
      longrun.querySelector('.lr-name').textContent  = r.name || r.id || '';
      longrun.querySelector('.lr-where').textContent = r.where || '';
      longrun.querySelector('.lr-fill').style.width  = (r.progress || 0) + '%';
      longrun.querySelector('.lr-eta').textContent   = r.eta || '';
    } else {
      longrun.hidden = true;
    }
  } catch (_) {
    longrun.hidden = true;
  }
};

modeBtns.forEach(btn => btn.addEventListener('click', () => app.go(btn.dataset.mode)));

document.querySelectorAll('[data-panel]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const panel = btn.dataset.panel;
    const el = panel === 'rail' ? rail : ctx;
    if (panel === 'rail') ctx.classList.remove('open'); else rail.classList.remove('open');
    el.classList.toggle('open');
  });
});

document.addEventListener('click', e => {
  if (e.target.closest('.rail') || e.target.closest('.ctx') || e.target.closest('[data-panel]')) return;
  rail.classList.remove('open');
  ctx.classList.remove('open');
});

const initialMode = localStorage.getItem(LS_MODE) || 'library';
app.go(initialMode);
app.refreshRuns();
setInterval(() => app.refreshRuns(), 15000);
