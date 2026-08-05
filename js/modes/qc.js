/* LoreCore — QC.
   Funn er en adresse. Grupperes etter hva de bryter.
   Severity-skalaen er basens: critical|major|minor|style.
   Status er open|applied|deferred|rejected — det finnes ingen "closed". */

import { esc, onClick, toast, reasonModal, fmtNum } from '../transport.js';
import { store, SEVERITY, FINDING_STATUS } from '../store.js';

let A = null;
let D = { findings: [], health: null, chapters: [], briefs: {} };
let filter = 'open';
let wired = false;
const sel = () => A.state.sel.qc;

const GROUPS = [
  { key: 'author', label: 'Bryter forfatteren' },
  { key: 'canon',  label: 'Bryter kanon' },
  { key: 'other',  label: 'Kan ikke vurderes' },
];

/* Basen har ingen "breaks"-kolonne. Utledes av pass_name til den finnes. */
function breaksOf(f) {
  const p = (f.pass_name || '').toLowerCase();
  if (/canon|constraint|continuity|coherence/.test(p)) return 'canon';
  if (/voice|dash|rhythm|monopol|lock|tense|triadic|regi|style/.test(p)) return 'author';
  return 'other';
}

export async function render(app) {
  A = app;
  A.paintTop();
  const [findings, health, chapters, briefs] = await Promise.all([
    store.findings(A.state.bookPid, 'all'),
    store.health(A.state.bookPid),
    store.chapters(A.state.bookPid),
    store.briefs(),
  ]);
  D = { findings, health, chapters, briefs };
  if (!findings.some(f => f.public_id === sel().pid)) sel().pid = findings[0]?.public_id || null;
  paintRail(); paintCenter(); paintCtx(); wire();
}

function visible() {
  return D.findings.filter(f =>
    filter === 'all' ? true
    : filter === 'closed' ? FINDING_STATUS[f.status]?.closed
    : filter === 'open' ? f.status === 'open'
    : f.status === 'open' && f.severity === filter);
}

function paintRail() {
  const open = D.findings.filter(f => f.status === 'open');
  const n = sev => open.filter(f => f.severity === sev).length;
  const list = visible();

  A.els.rail.innerHTML = `
    <div class="zt cond"><span>Funn</span><span>${open.length} åpne</span></div>
    <div class="filters">
      ${[['open', 'åpne ' + open.length], ['critical', 'kritisk ' + n('critical')],
         ['major', 'større ' + n('major')], ['minor', 'mindre ' + n('minor')],
         ['style', 'stil ' + n('style')],
         ['closed', 'lukket ' + D.findings.filter(f => FINDING_STATUS[f.status]?.closed).length]]
        .map(([k, l]) => `<span class="f ${filter === k ? 'on' : ''}" data-filter="${k}">${l}</span>`).join('')}
    </div>
    ${GROUPS.map(g => {
      const items = list.filter(f => breaksOf(f) === g.key);
      if (!items.length) return '';
      return `<div class="grp cond">${g.label}</div>` + items.map(f => `
        <div class="fi ${f.public_id === sel().pid ? 'on' : ''}" data-finding="${f.public_id}">
          <div class="fi-t"><span>${esc((f.issue_description || '').slice(0, 60))}</span>
            <span class="sev ${SEVERITY[f.severity]?.cls || 'min'}">${esc(f.pass_name || '')}</span></div>
          <div class="fi-m">kap ${f.chapter_n ?? '—'}${f.location_ref ? ' · ' + esc(f.location_ref) : ''}</div>
        </div>`).join('');
    }).join('')}
    ${!list.length ? `<div class="scope-note" style="padding:14px;line-height:1.6">
      Ingen funn i dette filteret.<br><br>
      Tabellen <span class="mono">lore_audit_findings</span> er tom for denne boka.
      Funn oppstår når et audit-pass kjøres.</div>` : ''}`;
}

function paintCenter() {
  const f = D.findings.find(x => x.public_id === sel().pid);
  if (!f) return paintEmpty();

  A.els.main.innerHTML = `
    <div class="mh">
      <div class="crumb">Funn / ${GROUPS.find(g => g.key === breaksOf(f)).label.toLowerCase()}</div>
      <div class="mt">${esc((f.issue_description || '').slice(0, 90))}
        <span class="sev ${SEVERITY[f.severity]?.cls || 'min'}">${SEVERITY[f.severity]?.label || f.severity}</span></div>
      <div class="msub">Pass <span class="mono">${esc(f.pass_name || '')}</span> ·
        ${f.audit_agent_name ? 'agent ' + esc(f.audit_agent_name) + ' · ' : ''}status ${FINDING_STATUS[f.status]?.label || f.status}</div>
    </div>
    <div class="mb">
      <div class="sec"><div class="sech cond">Beskrivelse</div>
        <div class="rulebox"><div class="rb">${esc(f.issue_description || '')}</div></div></div>
      ${f.suggested_fix ? `
      <div class="sec"><div class="sech cond"><span>Foreslått fiks</span>
        <span class="rsrc">fra audit-agenten</span></div>
        <div class="rulebox"><div class="rb">${esc(f.suggested_fix)}</div></div></div>` : ''}
      <div class="sec"><div class="sech cond">Adresse</div>
        <div class="hit"><div class="hith" ${f.chapter_n ? `data-goto="${f.chapter_n}"` : ''}>
          <span class="hitloc">kap ${f.chapter_n ?? '—'}${f.scene_public_id ? ' · ' + esc(f.scene_public_id) : ''}</span>
          <span class="rsrc">${f.chapter_n ? 'åpne →' : ''}</span></div></div></div>
    </div>`;
}

/* Tomt er ikke tomt: vis hva som ER målbart, og hva som mangler for å måle det. */
function paintEmpty() {
  const briefs = Object.values(D.briefs);
  const constraints = {};
  briefs.forEach(b => (b.constraints || []).forEach(k => constraints[k] = (constraints[k] || 0) + 1));

  A.els.main.innerHTML = `
    <div class="mh">
      <div class="crumb">QC / ${A.state.versionLabel}</div>
      <div class="mt">Ingen funn registrert</div>
      <div class="msub">Ingenting er auditert på denne versjonen ennå.
        Under står det som er målbart i dag.</div>
    </div>
    <div class="mb">
      <div class="sec"><div class="sech cond"><span>Absolutte begrensninger i briefsene</span>
        <span class="rsrc">maskinlesbare never-regler · ${briefs.length} kapitler</span></div>
        ${Object.keys(constraints).length ? `
        <div class="rulebox">${Object.entries(constraints).sort((a, b) => b[1] - a[1]).map(([k, n]) => `
          <div class="rb" style="border-bottom:1px solid var(--soft);display:flex;justify-content:space-between">
            <span><span class="ct never">aldri</span><span class="mono">${esc(k)}</span></span>
            <span class="rsrc">${n} kapitler</span></div>`).join('')}
        </div>
        <div class="hint" style="font-size:11px">Disse er allerede strukturerte. Et mekanisk pass kan måle mot dem uten ny modellering.</div>`
        : '<div class="empty">Ingen briefs med begrensninger.</div>'}
      </div>

      <div class="sec"><div class="sech cond"><span>Substrat-tilstand</span>
        <span class="rsrc">avledet, ikke auditert</span></div>
        <div class="metrics">
          <div class="met"><div class="ml">Kapitler</div><div class="mv">${D.health.chapters}</div><div class="mfoot">i versjonen</div></div>
          <div class="met"><div class="ml">Uten brief</div><div class="mv ${D.health.without_brief ? 'bad' : 'ok'}">${D.health.without_brief}</div><div class="mfoot">kan ikke vurderes</div></div>
          <div class="met"><div class="ml">Uten prosa</div><div class="mv ${D.health.without_prose ? 'bad' : 'ok'}">${D.health.without_prose}</div><div class="mfoot">ikke skrevet</div></div>
          <div class="met"><div class="ml">Lavt verdikt</div><div class="mv ${D.health.flagged ? 'bad' : 'ok'}">${D.health.flagged}</div><div class="mfoot">under 80</div></div>
          <div class="met"><div class="ml">Foreldreløse briefs</div><div class="mv ${D.health.briefs_orphaned ? 'bad' : 'ok'}">${D.health.briefs_orphaned}</div><div class="mfoot">book_public_id NULL</div></div>
          <div class="met"><div class="ml">Åpne funn</div><div class="mv ${D.health.open_findings ? 'bad' : 'ok'}">${D.health.open_findings}</div><div class="mfoot">lore_audit_findings</div></div>
        </div>
      </div>

      <div class="sec"><div class="sech cond"><span>Pass som kan kjøres</span>
        <span class="rsrc">mekaniske single-model · vurdering 3-way</span></div>
        ${[['em_dash_density', 'Em-dash-tetthet', 'mekanisk'],
           ['word_monopoly', 'Ordmonopol', 'mekanisk'],
           ['name_form', 'Navneform-konsistens', 'mekanisk'],
           ['tense_drift', 'Tempus-drift', 'mekanisk'],
           ['constraint_check', 'Absolutte begrensninger', 'mekanisk'],
           ['canon_violation', 'Kanonbrudd', '3-way'],
           ['voice_contamination', 'Stemme-kontaminering', '3-way'],
           ['regi_leakage', 'Regi-lekkasje', '3-way']].map(([k, l, kind]) => `
          <div class="passrow"><span class="pn">${l}</span>
            <span class="ps">${kind}</span>
            <button class="btn sm" data-pass="${k}">Kjør</button></div>`).join('')}
      </div>
    </div>`;
}

function paintCtx() {
  const f = D.findings.find(x => x.public_id === sel().pid);
  const h = D.health;
  A.els.ctx.innerHTML = `
    ${f ? `
    <div class="blk"><div class="bl cond">Fiks dette</div>
      <button class="btn go act" data-rewrite>Skriv om kapittel ${f.chapter_n ?? '—'}</button>
      <div class="hint">Går mot <span class="mono">regenerate-chapter/${f.chapter_n ?? 'N'}</span>,
        som allerede finnes i pipeline-API-et.</div>
    </div>
    <div class="blk"><div class="bl cond">Lukking</div>
      <div class="closed">Verifieren setter <span class="mono">applied</span> etter omskriving.
        Du kan sette <span class="mono">deferred</span> eller <span class="mono">rejected</span> — begge krever grunn.</div>
      ${f.status === 'open' ? `
        <button class="btn act" style="margin-top:8px" data-status="deferred">Utsett med grunn</button>
        <button class="btn act" data-status="rejected">Avvis med grunn</button>`
        : `<div class="hint" style="color:var(--gr)">${FINDING_STATUS[f.status]?.label}${
             f.override_reason ? ' — ' + esc(f.override_reason) : ''}</div>`}
    </div>` : ''}
    <div class="blk"><div class="bl cond">Bokas helse</div>
      <div class="kr"><span class="kk">Kritiske funn</span><span class="kv ${h.critical ? 'bad' : 'ok'}">${h.critical}</span></div>
      <div class="kr"><span class="kk">Uten brief</span><span class="kv ${h.without_brief ? 'bad' : 'ok'}">${h.without_brief}</span></div>
      <div class="kr"><span class="kk">Uten prosa</span><span class="kv ${h.without_prose ? 'bad' : 'ok'}">${h.without_prose}</span></div>
      <div class="kr"><span class="kk">Kan utgis</span><span class="kv bad">nei</span></div>
      <div class="hint">Utgivelse låses opp når kritiske funn er 0 og alle kapitler kan vurderes.</div>
    </div>`;
}

function wire() {
  if (wired) return;
  wired = true;
  onClick(A.els.rail, '[data-filter]', el => { filter = el.dataset.filter; paintRail(); });
  onClick(A.els.rail, '[data-finding]', el => {
    sel().pid = el.dataset.finding; paintRail(); paintCenter(); paintCtx();
  });
  onClick(A.els.main, '[data-goto]', el => {
    const n = +el.dataset.goto;
    const c = D.chapters.find(x => x.order_index === n);
    if (c) A.go('library', { kind: 'chapter', pid: c.public_id });
  });
  onClick(A.els.main, '[data-pass]', async el => {
    await store.startRun({ stage: 'audit:' + el.dataset.pass, book_public_id: A.state.bookPid,
      scope_kind: 'book', scope_pid: A.state.bookPid });
    toast('Pass startet mot ' + A.state.versionLabel, 'ok');
    A.refreshRuns();
  });
  onClick(A.els.ctx, '[data-rewrite]', async () => {
    const f = D.findings.find(x => x.public_id === sel().pid);
    await store.regenerateChapter(f.pipeline_run_id || 'unknown', f.chapter_n);
    toast('Omskriving startet. Funnet lukkes av verifieren.', 'ok');
  });
  onClick(A.els.ctx, '[data-status]', async el => {
    const st = el.dataset.status;
    const reason = await reasonModal(st === 'deferred' ? 'Utsett funn' : 'Avvis funn',
      'Grunnen lagres på raden og overlever rerun.');
    if (!reason) return;
    await store.setFindingStatus(sel().pid, st, reason);
    D.findings = await store.findings(A.state.bookPid, 'all');
    paintRail(); paintCenter(); paintCtx();
    toast('Funn satt til ' + FINDING_STATUS[st].label, 'ok');
  });
}
