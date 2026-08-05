/* LoreCore — Library.
   Fire skop med hvert sitt nivå. Versjon er bryter, ikke gren.
   Badge kun ved avvik. Senteret er aldri tomt. */

import { esc, onClick, toast, confirmModal, fmtNum } from '../transport.js';
import { store } from '../store.js';

let A = null;
let data = { overview: null, chapters: [], authors: [], sources: [], canon: null };
let wired = false;
let expanded = false;

const sel = () => A.state.sel.library;

export async function render(app) {
  A = app;
  A.paintTop();
  A.els.topAction ||= null;

  const [overview, chapters, authors, sources, canon] = await Promise.all([
    A.state.overview ? Promise.resolve(A.state.overview) : store.overview(A.state.libraryPid),
    store.chapters(A.state.bookPid),
    store.authors(),
    store.sources(),
    store.canon(A.state.universeId),
  ]);
  data = { overview, chapters, authors, sources, canon };
  A.state.overview = overview;

  paintRail();
  await paintCenter();
  wire();
}

/* ─────────── venstre: fire skop ─────────── */

/* Kapitler med avvik må alltid være synlige. En badge bak en sammenslått
   liste er ingen badge. Vises: de tre første, alle flaggede, det valgte
   og naboene. Resten stille bak «+ N til». */
function railChapters() {
  const s = sel();
  const keep = new Set();
  data.chapters.slice(0, 3).forEach(c => keep.add(c.public_id));
  data.chapters.forEach((c, i) => {
    if (!c.flags.length && c.public_id !== s.pid) return;
    keep.add(c.public_id);
    if (data.chapters[i - 1]) keep.add(data.chapters[i - 1].public_id);
    if (data.chapters[i + 1]) keep.add(data.chapters[i + 1].public_id);
  });
  return data.chapters.filter(c => keep.has(c.public_id));
}

function paintRail() {
  const s = sel();
  const grp = data.overview.book_groups[0];
  const shown = expanded ? data.chapters : railChapters();
  const rest = data.chapters.length - shown.length;

  A.els.rail.innerHTML = `
    <div class="scope">
      <div class="scope-h cond"><span>Kilder</span><span class="n">${data.overview.counts.sources}</span></div>
      <div class="scope-note">Minte stemmer · globalt</div>
      ${data.sources.map(x => `
        <div class="it ${s.kind === 'source' && s.pid === x.public_id ? 'sel' : ''}"
             data-pick="source" data-pid="${x.public_id}">
          <span>${esc(x.name)}</span><span class="count">${x.works.length}</span></div>`).join('')}
    </div>

    <div class="scope">
      <div class="scope-h cond"><span>Forfattere</span><span class="n">${data.authors.length}</span></div>
      <div class="scope-note">Komponerte stemmer · globalt</div>
      ${data.authors.map(x => `
        <div class="it ${s.kind === 'author' && s.pid === x.public_id ? 'sel' : ''}"
             data-pick="author" data-pid="${x.public_id}"><span>${esc(x.name)}</span></div>`).join('')}
      <div class="it muted" data-new-author><span>+ ny forfatter</span></div>
    </div>

    <div class="scope">
      <div class="scope-h cond"><span>Kanon</span><span class="n">${
        data.overview.canon.worlds + data.overview.canon.characters + data.overview.canon.locations}</span></div>
      <div class="scope-note">Per univers · deles av alle versjoner</div>
      <div class="it ${s.kind === 'canon' ? 'sel' : ''}" data-pick="canon" data-pid="worlds">
        <span>Verdener</span><span class="count">${data.overview.canon.worlds}</span></div>
      <div class="it" data-pick="canon" data-pid="characters">
        <span>Karakterer</span><span class="count">${data.overview.canon.characters}</span></div>
      <div class="it" data-pick="canon" data-pid="locations">
        <span>Lokasjoner</span><span class="count">${data.overview.canon.locations}</span></div>
    </div>

    <div class="scope">
      <div class="scope-h cond"><span>Bøker</span><span class="n">${data.overview.book_groups.length}</span></div>
      <div class="scope-note">Per bok · versjon som bryter</div>
      <div class="it sel" style="border-left-color:var(--ac)"><span>${esc(grp.title)}</span></div>
      <div class="verpick">
        ${grp.versions.map(v => `
          <span class="v ${v.public_id === A.state.bookPid ? 'on' : ''}"
                data-version="${v.public_id}" data-label="${v.version_label}"
                title="${v.status} · ${fmtNum(v.word_count)} ord">${v.version_label}</span>`).join('')}
      </div>
      <div class="grp cond">Kapitler · ${data.chapters.length}</div>
      ${shown.map(c => `
        <div class="it sub ${s.kind === 'chapter' && s.pid === c.public_id ? 'sel' : ''}"
             data-pick="chapter" data-pid="${c.public_id}">
          <span>${c.order_index} · ${esc(c.title)}</span>
          ${c.flags.map(f => `<span class="tag ${f.tone}">${f.label}</span>`).join('')}
        </div>`).join('')}
      ${rest > 0 ? `<div class="it sub muted" data-expand-chapters><span>+ ${rest} til</span></div>` : ''}
      <div class="grp cond">Plot</div>
      <div class="it sub" data-pick="acts" data-pid="acts"><span>Akter</span><span class="count">4</span></div>
    </div>`;
}



/* ─────────── senter ─────────── */

function head(crumb, title, badges, sub) {
  return `<div class="mh">
    <div class="crumb">${crumb}</div>
    <div class="mt">${title}${badges || ''}</div>
    ${sub ? `<div class="msub">${sub}</div>` : ''}</div>`;
}

async function paintCenter() {
  const s = sel();
  try {
    if (s.kind === 'chapter') return await viewChapter(s.pid);
    if (s.kind === 'canon')   return viewCanon(s.pid);
    if (s.kind === 'source')  return await viewSource(s.pid);
    if (s.kind === 'acts')    return viewActs();
    return await viewAuthor(s.pid || 'AUT-GALDURDAL');
  } catch (e) {
    console.error(e);
    A.els.main.innerHTML = head('Library', 'Klarte ikke å hente', '', esc(e.message));
    A.els.ctx.innerHTML = '';
  }
}

/* ---- forfatter ---- */
async function viewAuthor(pid) {
  const a = await store.author(pid);
  const ovr = await store.overrides(pid);

  A.els.main.innerHTML = head('Forfattere', esc(a.name), '',
    `Komponert av ${a.sources.length} kilder · brukt av ${a.used_by_books} bok`) + `
    <div class="mb">
      <div class="sec"><div class="sech cond">Bygget på</div>
        <div class="rowlist">${a.sources.map(s => `
          <div class="row" data-pick="source" data-pid="${s.public_id}">
            <span class="nm">${esc(s.name)}</span><span class="src">${s.aspects.join(' · ')}</span></div>`).join('')}
        </div>
      </div>

      <div class="sec"><div class="sech cond"><span>Regler</span><span class="src">${a.active_rules} aktive</span></div>
        <div class="voicebox">${a.rules.map(r => `
          <div class="vrule">
            <span class="rulekey">${r.rule_key}</span>
            <span class="cond-tag ${r.condition}">${({ always: 'alltid', when: 'når', never: 'aldri' })[r.condition]}</span>
            <span>${esc(r.rule_text)}${r.reads_from_canon
              ? ` <span class="src">leser ${r.reads_from_canon} — bor her</span>` : ''}</span>
          </div>`).join('')}
        </div>
      </div>

      ${ovr.length ? `
      <div class="sec"><div class="sech cond">Overstyres i</div>
        <div class="rowlist">${ovr.map(o => `
          <div class="row" data-pick="chapter" data-pid="${o.target_pid}">
            <span class="num mono">${o.target_number}</span>
            <span class="nm">${esc(o.target_label)}</span>
            <span class="src" style="color:var(--vi)">${esc(o.summary)}</span></div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;

  A.els.ctx.innerHTML = `
    <div class="blk"><div class="bl cond">Endre stemmen</div>
      <div class="hint">Forfattere lages og endres i Author gjennom dialog. Denne flaten viser hva som gjelder nå.</div>
      <button class="btn act" data-open-author style="margin-top:8px">Åpne i Author</button></div>
    <div class="blk"><div class="bl cond">Brukt av</div>
      <div class="kr"><span class="kk">Galdurdal Book 1</span><span class="kv">${data.overview.book_groups[0].versions.length} versjoner</span></div>
      <div class="kr"><span class="kk">Kapitler med overstyring</span><span class="kv ovr">${ovr.length}</span></div></div>
    <div class="blk"><div class="bl cond">Etterlevelse</div>
      ${a.compliance.map(c => `
        <div class="kr"><span class="kk">${esc(c.label)}</span><span class="kv ${c.state}">${esc(c.value)}</span></div>`).join('')}
      <button class="btn act" data-open-qc style="margin-top:8px">Se alle funn</button></div>`;
}

/* ---- kapittel ---- */
async function viewChapter(pid) {
  const c = await store.chapter(pid);
  const ovr = c.voice?.override;
  const badges = [
    ovr ? '<span class="badge ovr">egen stemme</span>' : '',
    c.brief_missing ? '<span class="badge warn">mangler brief</span>' : '',
  ].join('');

  const scene = c.scenes[0];

  A.els.main.innerHTML = head(
    `Galdurdal Book 1 / ${A.state.versionLabel}`,
    `Kapittel ${c.order_index} — ${esc(c.title)}`, badges,
    `POV ${esc(c.pov || '—')} · ${c.scene_count || c.scenes.length} scener · ${fmtNum(c.word_count)} ord`) + `
    <div class="mb">
      ${ovr ? `
      <div class="sec">
        <div class="sech cond"><span>Stemme-overstyring</span>
          <span class="src">satt ${new Date(ovr.set_at).toLocaleDateString('no-NO')} · arver Galdurdal-stemmen</span></div>
        <div class="voicebox">
          <div class="vhead"><span class="vname">Avvik fra forfatteren</span>
            <button class="btn" data-remove-override="${ovr.public_id}">Fjern overstyring</button></div>
          <div style="padding:11px 13px">
            ${ovr.rule_deltas.map(d => `
              <div class="diffline">
                <span>${ruleName(d.rule_key)} <span class="mono" style="color:var(--tx3)">${d.rule_key}</span></span>
                <span class="dn">${d.direction === 'up' ? 'opp' : 'ned'} — ${esc(d.note)}</span></div>`).join('')}
            <div class="diffline"><span>Alle øvrige regler</span><span style="color:var(--tx3)">arvet uendret</span></div>
            <div class="hint" style="margin-top:10px">Grunn: ${esc(ovr.reason)}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:9px">
          <button class="btn go" data-run="chapters" data-scope="${c.public_id}">Skriv kapittelet på nytt</button>
          <button class="btn" data-open-author>Juster i Author</button>
        </div>
      </div>` : ''}

      <div class="sec">
        <div class="sech cond">${scene ? `Scene ${scene.order_index} — brief og prosa` : 'Brief og prosa'}</div>
        <div class="split">
          <div class="pane"><div class="ptitle cond">Brief</div>
            ${c.brief_missing || !scene?.key_beats?.length ? `
              <div class="empty">Ingen brief lagret for dette kapittelet.<br>
                Prosaen finnes, men kontrakten den skulle skrives mot mangler.
                <br><button class="btn go" data-run="briefs" data-scope="${c.public_id}">Kjør brief-modulen</button></div>` : `
              <div class="beat"><b>POV</b> ${esc(scene.pov)} · ${esc(scene.location || '')}</div>
              ${scene.key_beats.map((b, i) => `<div class="beat"><b>Beat ${i + 1}</b> ${esc(b)}</div>`).join('')}`}
          </div>
          <div class="pane"><div class="ptitle cond">Prosa</div>
            ${scene?.content
              ? `<div class="prose">${esc(scene.content)}</div>`
              : `<div class="empty">Ingen prosa lagret.<button class="btn go" data-run="chapters" data-scope="${c.public_id}">Kjør kapittel-modulen</button></div>`}
          </div>
        </div>
      </div>
    </div>`;

  const fnd = (await store.findings(A.state.bookPid))
    .filter(f => f.scope_label?.includes(`kap ${c.order_index}`));

  A.els.ctx.innerHTML = `
    ${c.brief_missing ? `
      <div class="blk"><div class="bl cond">Hva mangler</div>
        <div class="find"><div class="ft"><span>Brief ikke lagret</span><span class="sev blk">blokker</span></div>
          <div class="fd">${esc(c.brief_missing_note || '')}</div></div>
        <button class="btn go act" data-run="briefs" data-scope="${c.public_id}">Kjør brief-modulen</button></div>` : ''}
    ${fnd.length ? `
      <div class="blk"><div class="bl cond">Funn i dette kapittelet</div>
        ${fnd.map(f => `
          <div class="find" data-open-finding="${f.public_id}">
            <div class="ft"><span>${esc(f.title)}</span><span class="sev ${sevClass(f.severity)}">${sevLabel(f.severity)}</span></div>
            <div class="fd">${f.summary}</div></div>`).join('')}
      </div>` : ''}
    <div class="blk"><div class="bl cond">Opphav</div>
      <div class="kr"><span class="kk">Run</span><span class="kv">${c.pipeline_run_id || 'ingen'}</span></div>
      ${c.written_by?.length ? `<div class="kr"><span class="kk">Skrevet av</span><span class="kv">${c.written_by.join(' · ')} → ${c.synthesized_by}</span></div>` : ''}
      <div class="kr"><span class="kk">Stemme</span><span class="kv ${ovr ? 'ovr' : ''}">${ovr ? 'overstyrt' : 'arvet'}</span></div>
      <div class="kr"><span class="kk">Kanon-sjekk</span><span class="kv ${c.canon_check === 'passed' ? 'ok' : 'bad'}">${
        c.canon_check === 'passed' ? 'bestått' : 'kan ikke vurderes'}</span></div></div>`;
}

/* ---- kanon ---- */
function viewCanon(which) {
  const k = data.canon;
  A.els.main.innerHTML = head(`Kanon / ${k.universe_id}`, 'Verden og karakterer', '',
    'Deles av alle bøker og versjoner i universet') + `
    <div class="mb">
      <div class="sec"><div class="sech cond">Verdener</div>
        <div class="rowlist">${k.worlds.map(w => `
          <div class="row"><span class="nm">${esc(w.name)}</span>
            <span class="src">${esc(w.kind)}${w.note ? ' · ' + esc(w.note) : ''}</span></div>`).join('')}
        </div></div>
      <div class="sec"><div class="sech cond">Karakterer</div>
        <div class="rowlist">${k.characters.map(c => `
          <div class="row"><span class="nm">${esc(c.name)}</span>
            <span class="src ${c.cold ? 'mono' : ''}">${esc(c.note || '—')}</span></div>`).join('')}
        </div></div>
    </div>`;

  A.els.ctx.innerHTML = `
    <div class="blk"><div class="bl cond">Scope</div>
      <div class="hint">Kanon er per univers. Bytter du versjon på boka, endres ikke dette.</div></div>
    <div class="blk"><div class="bl cond">Leses av</div>
      ${k.read_by.map(r => `<div class="kr"><span class="kk">${esc(r.label)}</span>
        <span class="kv ${r.state}">${esc(r.value)}</span></div>`).join('')}</div>`;
}

/* ---- kilde sett fra Library ---- */
async function viewSource(pid) {
  const s = await store.source(pid);
  const mined = s.aspects.filter(a => a.status === 'mined');
  A.els.main.innerHTML = head('Kilder', esc(s.name), '',
    `${s.works.length} bøker minte · brukt i ${s.used_in.length} forfatter`) + `
    <div class="mb">
      <div class="sec"><div class="sech cond">Uttrukne trekk</div>
        <div class="voicebox">${mined.map((a, i) => `
          <div class="vrule"><span class="rulekey">${String(i + 1).padStart(2, '0')}</span>
            <span>${renderSummary(a.summary)}</span></div>`).join('')}
        </div></div>
      <div class="sec"><div class="sech cond">Brukt i</div>
        <div class="rowlist">${s.used_in.map(u => `
          <div class="row" data-pick="author" data-pid="${u.public_id}">
            <span class="nm">${esc(u.name)}</span><span class="src">ryggrad</span></div>`).join('')}
        </div></div>
    </div>`;

  A.els.ctx.innerHTML = `
    <div class="blk"><div class="bl cond">Kilde</div>
      <div class="kr"><span class="kk">Bøker minte</span><span class="kv">${s.works.length}</span></div>
      <div class="kr"><span class="kk">Aspekter</span><span class="kv">${mined.length} av ${s.aspects.length}</span></div>
      <div class="kr"><span class="kk">Scope</span><span class="kv">globalt</span></div>
      <div class="hint">Kilder går på tvers av univers. Samme kilde kan brukes i flere forfattere.</div></div>
    <button class="btn act" data-open-kilder>Åpne i Kilder</button>`;
}

function viewActs() {
  A.els.main.innerHTML = head(`Galdurdal Book 1 / ${A.state.versionLabel}`, 'Akter', '', '4 akter · 25 kapitler') + `
    <div class="mb"><div class="empty">Akt-visningen henter fra <span class="mono">lore_acts</span>.
      Endepunktet finnes ikke ennå — står som punkt 5 i byggerekkefølgen.</div></div>`;
  A.els.ctx.innerHTML = '';
}

/* ─────────── hjelpere ─────────── */

const RULE_NAMES = { R1: 'Cornwell-ryggrad', R2: 'Rothfuss-interioritet', R3: 'Wilde-legendeløft', R7: 'Primitivt lag', R9: 'Ordmonopol' };
const ruleName = k => RULE_NAMES[k] || k;
const sevClass = s => ({ blocker: 'blk', major: 'maj', minor: 'min' }[s] || 'min');
const sevLabel = s => ({ blocker: 'blokker', major: 'større', minor: 'mindre' }[s] || s);
const renderSummary = t => esc(t).replace(/\{([^}]+)\}/g, '<span class="mono" style="color:var(--tx)">$1</span>');

/* ─────────── hendelser ─────────── */

function wire() {
  if (wired) return;
  wired = true;

  onClick(A.els.rail, '[data-pick]', async el => {
    A.state.sel.library = { kind: el.dataset.pick, pid: el.dataset.pid };
    paintRail(); await paintCenter();
  });
  onClick(A.els.rail, '[data-expand-chapters]', () => { expanded = true; paintRail(); });
  onClick(A.els.rail, '[data-new-author]', () =>
    toast('Forfattere lages gjennom dialog i Author, ikke som skjema her.'));

  onClick(A.els.rail, '[data-version]', async el => {
    A.setBook(el.dataset.version, el.dataset.label);
    data.chapters = await store.chapters(A.state.bookPid);
    paintRail(); await paintCenter();
  });

  onClick(A.els.main, '[data-pick]', async el => {
    A.state.sel.library = { kind: el.dataset.pick, pid: el.dataset.pid };
    paintRail(); await paintCenter();
  });

  const runHandler = async el => {
    const r = await store.startRun({
      module_key: el.dataset.run, scope_kind: 'chapter', scope_pid: el.dataset.scope });
    toast(`Startet ${el.dataset.run} · ${r.public_id}`, 'ok');
    A.refreshRuns();
  };
  onClick(A.els.main, '[data-run]', runHandler);
  onClick(A.els.ctx, '[data-run]', runHandler);

  onClick(A.els.main, '[data-remove-override]', async el => {
    const ok = await confirmModal('Fjern overstyring',
      'Kapittelet faller tilbake til forfatterens regler. Overstyringsraden slettes, og grunnen med den.', 'Fjern');
    if (!ok) return;
    await store.removeOverride(el.dataset.removeOverride);
    toast('Overstyring fjernet', 'ok');
    await paintCenter();
  });

  onClick(A.els.ctx, '[data-open-author]', () => A.go('author'));
  onClick(A.els.main, '[data-open-author]', () => A.go('author'));
  onClick(A.els.ctx, '[data-open-qc]', () => A.go('qc'));
  onClick(A.els.ctx, '[data-open-kilder]', () => A.go('kilder', { pid: sel().pid }));
  onClick(A.els.ctx, '[data-open-finding]', el => A.go('qc', { pid: el.dataset.openFinding }));
}
