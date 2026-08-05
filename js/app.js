/* LoreCore — app shell.
   Eier modus-ruting, delt tilstand og den vedvarende kjøringslinja.
   Flatene eier sitt eget innhold og rører aldri hverandre direkte —
   navigasjon mellom flater går gjennom app.go(). */

import { $, toast } from './transport.js';
import { store } from './store.js';

import * as Author  from './modes/author.js';
import * as Library from './modes/library.js';
import * as QC      from './modes/qc.js';
import * as Kilder  from './modes/kilder.js';

const MODES = {
  author:  { label: 'Author',  mod: Author },
  library: { label: 'Library', mod: Library },
  qc:      { label: 'QC',      mod: QC },
  kilder:  { label: 'Kilder',  mod: Kilder },
};

const LS = {
  get(k, fb) { try { return localStorage.getItem('lorecore.' + k) ?? fb; } catch { return fb; } },
  set(k, v)  { try { localStorage.setItem('lorecore.' + k, v); } catch {} },
};

export const app = {
  mode: null,
  state: {
    libraryPid: LS.get('libraryId', 'LIB-GALDURDAL-B1-V2'),
    universeId: 'UNI-GALDURDAL',
    bookPid: LS.get('bookId', ''),
    versionLabel: '',
    authorPid: null,
    overview: null,
    /* per-flate valg, holdes slik at retur til en flate ikke mister sted */
    sel: {
      library: { kind: 'author', pid: 'none' },
      qc:      { pid: null, filter: 'open' },
      kilder:  { pid: null },
      author:  { sessionPid: null },
    },
  },

  els: {
    shell: null, top: null, rail: null, main: null, ctx: null,
    modes: null, uni: null, topAction: null, longrun: null,
  },

  /* Navigasjon mellom flater. Én inngang, så flatene slipper å kjenne hverandre. */
  async go(mode, sel) {
    if (!MODES[mode]) return;
    if (sel) Object.assign(this.state.sel[mode], sel);
    if (this.mode === mode) { await MODES[mode].mod.render(this); return; }

    this.mode = mode;
    LS.set('mode', mode);
    this.els.shell.dataset.mode = mode;
    [...this.els.modes.children].forEach(b => b.classList.toggle('on', b.dataset.mode === mode));

    this.els.rail.innerHTML = '';
    this.els.main.innerHTML = '';
    this.els.ctx.innerHTML = '';
    this.els.rail.classList.remove('open');
    this.els.ctx.classList.remove('open');

    try { await MODES[mode].mod.render(this); }
    catch (e) { console.error(e); toast('Klarte ikke å åpne ' + MODES[mode].label + ': ' + e.message, 'bad'); }
  },

  setBook(bookPid, versionLabel) {
    this.state.bookPid = bookPid;
    this.state.versionLabel = versionLabel;
    LS.set('bookId', bookPid);
    this.paintTop();
  },

  paintTop() {
    const s = this.state;
    if (this.mode === 'kilder') {
      this.els.uni.innerHTML = 'Eget referansebibliotek';
    } else if (this.mode === 'qc') {
      this.els.uni.innerHTML = `Bok <b>Galdurdal Book 1 · ${s.versionLabel}</b> · Forfatter <b>ingen</b>`;
    } else if (this.mode === 'author') {
      this.els.uni.innerHTML = `Univers <b>${s.universeId}</b> · Bok <b>${s.versionLabel}</b>`;
    } else {
      this.els.uni.innerHTML = `Univers <b>${s.universeId}</b>`;
    }
  },

  /* Vedvarende kjøringslinje. Lange kjøringer blokkerer aldri tenkerommet. */
  async refreshRuns() {
    let runs = [];
    try { runs = await store.activeRuns(); } catch {}
    const bar = this.els.longrun;
    if (!runs.length) { bar.hidden = true; return; }
    const r = runs[0];
    bar.hidden = false;
    bar.innerHTML = `
      <span class="lr-dot"></span>
      <span class="lr-name">${r.label}</span>
      <span class="lr-where">${r.where || ''}</span>
      <div class="lr-track"><div class="lr-fill" style="width:${r.percent || 0}%"></div></div>
      <span class="lr-eta">${r.eta_minutes ? '~' + r.eta_minutes + ' min igjen' : ''}</span>
      <button class="btn sm" data-run-open>Se</button>
      <button class="btn sm" data-run-pause>Pause</button>`;
  },
};

/* ---------- oppstart ---------- */

function boot() {
  const e = app.els;
  e.shell = $('#shell'); e.rail = $('#rail'); e.main = $('#main'); e.ctx = $('#ctx');
  e.modes = $('#modes'); e.uni = $('#uni'); e.longrun = $('#longrun');

  e.modes.innerHTML = Object.entries(MODES)
    .map(([k, v]) => `<button class="mode" data-mode="${k}">${v.label}</button>`).join('');

  e.modes.addEventListener('click', ev => {
    const b = ev.target.closest('[data-mode]');
    if (b) app.go(b.dataset.mode);
  });

  e.longrun.addEventListener('click', ev => {
    if (ev.target.closest('[data-run-open]')) app.go('author');
    if (ev.target.closest('[data-run-pause]')) toast('Pause krever POST /api/lorecore/runs/{pid}/pause — ikke bygget ennå.');
  });

  /* rail/ctx som skuffer på smale skjermer */
  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-toggle-rail]')) e.rail.classList.toggle('open');
    if (ev.target.closest('[data-toggle-ctx]'))  e.ctx.classList.toggle('open');
  });

  store.overview(app.state.libraryPid).then(o => { app.state.overview = o; }).catch(() => {});
  app.refreshRuns();
  setInterval(() => app.refreshRuns(), 20000);

  const start = new URLSearchParams(location.search).get('mode') || LS.get('mode', 'library');
  app.go(MODES[start] ? start : 'library');
}

document.addEventListener('DOMContentLoaded', boot);
