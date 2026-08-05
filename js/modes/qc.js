/* LoreCore — QC.
   Funn er en adresse, ikke tekst. Grupperes etter hva de bryter.
   Verifieren lukker funnet, ikke operatøren. */

import { esc, onClick, toast, reasonModal, fmtDate } from '../transport.js';
import { store } from '../store.js';

let A = null;
let data = { findings: [], metrics: null, passes: [], health: null };
let filter = 'all';
let fixScope = null;
let wired = false;

const sel = () => A.state.sel.qc;

const GROUPS = [
  { key: 'author',       label: 'Bryter forfatteren' },
  { key: 'canon',        label: 'Bryter kanon' },
  { key: 'unassessable', label: 'Kan ikke vurderes' },
];

const sevClass = s => ({ blocker: 'blk', major: 'maj', minor: 'min' }[s] || 'min');
const sevLabel = s => ({ blocker: 'blokker', major: 'større', minor: 'mindre' }[s] || s);

export async function render(app) {
  A = app;
  A.paintTop();

  const [findings, metrics, passes, health] = await Promise.all([
    store.findings(A.state.bookPid, 'all'),
    store.metrics(A.state.bookPid),
    store.passes(A.state.bookPid),
    store.health(A.state.bookPid),
  ]);
  data = { findings, metrics, passes, health };

  if (!findings.some(f => f.public_id === sel().pid)) {
    sel().pid = findings.find(f => f.status === 'open')?.public_id || findings[0]?.public_id;
  }
  fixScope = null;

  paintRail();
  paintCenter();
  paintCtx();
  wire();
}

/* ─────────── venstre: arbeidskøen ─────────── */

function visible() {
  return data.findings.filter(f => {
    if (filter === 'all')    return f.status === 'open';
    if (filter === 'closed') return f.status === 'closed';
    return f.status === 'open' && f.severity === filter;
  });
}

function paintRail() {
  const open = data.findings.filter(f => f.status === 'open');
  const count = sev => open.filter(f => f.severity === sev).length;
  const closed = data.findings.filter(f => f.status === 'closed').length;
  const list = visible();

  A.els.rail.innerHTML = `
    <div class="zt cond"><span>Funn</span><span>${open.length} åpne</span></div>
    <div class="filters">
      <span class="f ${filter === 'all' ? 'on' : ''}" data-filter="all">alle</span>
      <span class="f ${filter === 'blocker' ? 'on' : ''}" data-filter="blocker">blokker ${count('blocker')}</span>
      <span class="f ${filter === 'major' ? 'on' : ''}" data-filter="major">større ${count('major')}</span>
      <span class="f ${filter === 'minor' ? 'on' : ''}" data-filter="minor">mindre ${count('minor')}</span>
      <span class="f ${filter === 'closed' ? 'on' : ''}" data-filter="closed">lukket ${closed}</span>
    </div>
    ${GROUPS.map(g => {
      const items = list.filter(f => f.breaks === g.key);
      if (!items.length) return '';
      return `<div class="grp cond">${g.label}</div>` + items.map(f => `
        <div class="fi ${f.public_id === sel().pid ? 'on' : ''}" data-finding="${f.public_id}">
          <div class="fi-t"><span>${esc(f.title)}</span>
            <span class="sev ${f.status === 'closed' ? 'cl' : sevClass(f.severity)}">${f.rule_key || '—'}</span></div>
          <div class="fi-m">${esc(f.scope_label)}</div>
        </div>`).join('');
    }).join('')}
    ${!list.length ? '<div class="scope-note" style="padding:14px">Ingen funn i dette filteret.</div>' : ''}`;
}

/* ─────────── senter: målestokk · treff · målinger · pass ─────────── */

function paintCenter() {
  const f = data.findings.find(x => x.public_id === sel().pid);
  if (!f) {
    A.els.main.innerHTML = `<div class="mh"><div class="mt">Ingen funn valgt</div></div>
      <div class="mb"><div class="empty">Velg et funn i køen til venstre.</div></div>`;
    return;
  }
  const g = GROUPS.find(x => x.key === f.breaks);
  const m = f.measured_against;

  A.els.main.innerHTML = `
    <div class="mh">
      <div class="crumb">Funn / ${g.label.toLowerCase()}</div>
      <div class="mt">${esc(f.title)}
        <span class="sev ${f.status === 'closed' ? 'cl' : sevClass(f.severity)}">${
          f.status === 'closed' ? 'lukket' : sevLabel(f.severity)}</span></div>
      <div class="msub">${f.summary}</div>
    </div>
    <div class="mb">
      ${m ? `
      <div class="sec"><div class="sech cond">Målestokken</div>
        <div class="rulebox">
          <div class="rh"><span><span class="rk">${m.rule_key}</span> ${esc(m.author_name)}</span>
            <span class="rsrc">${esc(m.inherited_note)}</span></div>
          <div class="rb"><span class="ct ${m.condition}">${
            ({ always: 'alltid', when: 'når', never: 'aldri' })[m.condition]}</span>${m.rule_text}</div>
        </div>
      </div>` : ''}

      ${f.hits?.length ? `
      <div class="sec"><div class="sech cond"><span>Treff</span>
        <span class="rsrc">klikk for å åpne i Library</span></div>
        ${f.hits.map(h => `
          <div class="hit">
            <div class="hith" data-goto="${h.target_pid}">
              <span class="hitloc">kap ${h.address.chapter} · scene ${h.address.scene} · setning ${h.address.sentence}</span>
              <span class="rsrc">åpne →</span></div>
            <div class="hitb">${esc(h.text_before)}<span class="mark">${esc(h.text_mark)}</span>${esc(h.text_after)}</div>
            <div class="why">${esc(h.why)}</div>
          </div>`).join('')}
      </div>` : ''}

      <div class="sec"><div class="sech cond"><span>Mekaniske målinger</span>
        <span class="rsrc">kjører kontinuerlig · sist ${fmtDate(data.metrics.last_run_at)}</span></div>
        <div class="metrics">${data.metrics.items.map(i => `
          <div class="met"><div class="ml">${esc(i.label)}</div>
            <div class="mv ${i.state}">${esc(i.value)}</div>
            <div class="mfoot">${esc(i.foot)}</div></div>`).join('')}
        </div>
      </div>

      <div class="sec"><div class="sech cond"><span>Vurderingspass</span>
        <span class="rsrc">3-way deliberation · kjøres på forespørsel</span></div>
        ${data.passes.map(p => `
          <div class="passrow"><span class="pn">${esc(p.label)}</span>
            <span class="ps ${p.state}">${esc(p.detail)}</span>
            <button class="btn sm" data-pass="${p.key}" ${p.state === 'running' ? 'disabled' : ''}>Kjør</button></div>`).join('')}
      </div>
    </div>`;
}

/* ─────────── høyre: fiks · lukking · helse ─────────── */

function paintCtx() {
  const f = data.findings.find(x => x.public_id === sel().pid);
  const h = data.health;
  const scopes = f?.fix_scopes || [];
  if (scopes.length && !fixScope) fixScope = scopes[0].key;

  A.els.ctx.innerHTML = `
    ${scopes.length ? `
    <div class="blk"><div class="bl cond">Fiks dette</div>
      <div class="scopepick">${scopes.map(s => `
        <div class="sp ${s.key === fixScope ? 'on' : ''}" data-fix="${s.key}">
          <span>${esc(s.label)}</span><span class="c">~${s.est_minutes} min</span></div>`).join('')}
      </div>
      <button class="btn go act" data-rewrite>Skriv om valgt scope</button>
      <button class="btn act" data-open-author>Juster ${f.rule_key || 'regelen'} i Author</button>
      <div class="hint">Omskriving kjører mot gjeldende forfatter. Kapittel 13 har egen stemme-overstyring, men ${f.rule_key || 'regelen'} er arvet uendret.</div>
    </div>` : ''}

    <div class="blk"><div class="bl cond">Lukking</div>
      <div class="closed">Funnet lukkes av verifieren, ikke av deg. Etter omskriving kjøres passet på nytt — forsvinner treffene, lukkes funnet automatisk med tidsstempel.</div>
      <div class="hint">Vil du overstyre, må det oppgis grunn. Overstyrte funn vises i «lukket» med eget merke.</div>
      ${f && f.status === 'open'
        ? '<button class="btn act" style="margin-top:8px" data-override>Overstyr med grunn</button>'
        : f ? `<div class="hint" style="color:var(--gr)">Lukket av ${f.closed_by === 'operator' ? 'operatør' : 'verifier'}${
            f.override_reason ? ' — ' + esc(f.override_reason) : ''}</div>` : ''}
    </div>

    <div class="blk"><div class="bl cond">Bokas helse</div>
      <div class="kr"><span class="kk">Blokkere</span><span class="kv ${h.blockers ? 'bad' : 'ok'}">${h.blockers}</span></div>
      <div class="kr"><span class="kk">Kanon-drift</span><span class="kv ${h.canon_drift ? 'bad' : 'ok'}">${h.canon_drift}</span></div>
      <div class="kr"><span class="kk">Kapitler uten brief</span><span class="kv ${h.chapters_without_brief ? 'bad' : 'ok'}">${h.chapters_without_brief}</span></div>
      <div class="kr"><span class="kk">Kan utgis</span><span class="kv ${h.publishable ? 'ok' : 'bad'}">${h.publishable ? 'ja' : 'nei'}</span></div>
      <div class="hint">Utgivelse låses opp når blokkere er 0 og alle kapitler kan vurderes.</div>
    </div>`;
}

/* ─────────── hendelser ─────────── */

function wire() {
  if (wired) return;
  wired = true;

  onClick(A.els.rail, '[data-filter]', el => {
    filter = el.dataset.filter; paintRail();
  });
  onClick(A.els.rail, '[data-finding]', el => {
    sel().pid = el.dataset.finding; fixScope = null;
    paintRail(); paintCenter(); paintCtx();
  });

  onClick(A.els.main, '[data-goto]', el =>
    A.go('library', { kind: 'chapter', pid: el.dataset.goto }));

  onClick(A.els.main, '[data-pass]', async el => {
    await store.runPass(el.dataset.pass, A.state.bookPid);
    data.passes = await store.passes(A.state.bookPid);
    paintCenter();
    toast('Vurderingspass startet — 3 familier + synthesizer', 'ok');
  });

  onClick(A.els.ctx, '[data-fix]', el => { fixScope = el.dataset.fix; paintCtx(); });

  onClick(A.els.ctx, '[data-rewrite]', async () => {
    const f = data.findings.find(x => x.public_id === sel().pid);
    const r = await store.startRun({
      module_key: 'rewrite', scope_kind: fixScope,
      scope_pid: f.hits[0]?.target_pid || A.state.bookPid });
    toast(`Omskriving startet · ${r.public_id}. Funnet lukkes av verifieren etterpå.`, 'ok');
    A.refreshRuns();
  });

  onClick(A.els.ctx, '[data-override]', async () => {
    const reason = await reasonModal('Overstyr funn',
      'Verifieren har ikke lukket dette. Overstyring merkes med din grunn og blir stående på raden.');
    if (!reason) return;
    await store.overrideFinding(sel().pid, reason);
    data.findings = await store.findings(A.state.bookPid, 'all');
    paintRail(); paintCenter(); paintCtx();
    toast('Funn lukket med grunn — merket som operatør-overstyring', 'ok');
  });

  onClick(A.els.ctx, '[data-open-author]', () => A.go('author'));
}
