/* LoreCore — Library.
   Fire skop. Versjon er bryter, ikke gren — de 7 bøkene ER versjonene
   av én gruppe. Badge kun ved avvik. Senteret er aldri tomt. */

import { esc, onClick, toast, fmtNum, fmtDate } from '../transport.js';
import { store } from '../store.js';

let A = null;
let D = { overview: null, chapters: [], canon: null, sources: [], authors: [] };
let expanded = false;
let wired = false;

const sel = () => A.state.sel.library;

export async function render(app) {
  A = app;
  const ov = await store.overview();
  A.state.overview = ov;
  A.state.libraryPid = ov.library.public_id;
  A.state.universeId = ov.library.universe_id;
  if (!ov.book_group.versions.some(v => v.public_id === A.state.bookPid)) {
    const d = ov.book_group.versions.find(v => v.public_id === ov.book_group.default_book);
    A.state.bookPid = d.public_id;
    A.state.versionLabel = d.version_label;
  }
  A.paintTop();

  const [chapters, canon, sources, authors] = await Promise.all([
    store.chapters(A.state.bookPid), store.canon(), store.sources(), store.authors(),
  ]);
  D = { overview: ov, chapters, canon, sources, authors };

  paintRail();
  await paintCenter();
  wire();
}

/* ─────────── venstre ─────────── */

/* Kapitler med avvik ma vaere synlige uten a utvide. */
function railChapters() {
  const s = sel();
  const keep = new Set();
  D.chapters.slice(0, 3).forEach(c => keep.add(c.public_id));
  D.chapters.forEach((c, i) => {
    if (!c.flags.length && c.public_id !== s.pid) return;
    keep.add(c.public_id);
    if (D.chapters[i - 1]) keep.add(D.chapters[i - 1].public_id);
    if (D.chapters[i + 1]) keep.add(D.chapters[i + 1].public_id);
  });
  return D.chapters.filter(c => keep.has(c.public_id));
}

function paintRail() {
  const s = sel(), ov = D.overview, g = ov.book_group;
  const shown = expanded ? D.chapters : railChapters();
  const rest = D.chapters.length - shown.length;

  A.els.rail.innerHTML = `
    <div class="scope">
      <div class="scope-h cond"><span>Kilder</span><span class="n">${ov.counts.sources}</span></div>
      <div class="scope-note">Minte stemmer · globalt</div>
      ${D.sources.map(x => `
        <div class="it ${s.kind === 'source' && s.pid === x.public_id ? 'sel' : ''}"
             data-pick="source" data-pid="${x.public_id}">
          <span>${esc(x.name)}</span><span class="count">${x.works.length}</span></div>`).join('')}
    </div>

    <div class="scope">
      <div class="scope-h cond"><span>Forfattere</span><span class="n">${D.authors.length}</span></div>
      <div class="scope-note">Komponerte stemmer · globalt</div>
      ${D.authors.length ? D.authors.map(x => `
        <div class="it ${s.kind === 'author' && s.pid === x.public_id ? 'sel' : ''}"
             data-pick="author" data-pid="${x.public_id}"><span>${esc(x.name)}</span></div>`).join('')
        : `<div class="it ${s.kind === 'author' ? 'sel' : ''}" data-pick="author" data-pid="none">
             <span style="color:var(--tx3)">Ingen komponert ennå</span></div>`}
    </div>

    <div class="scope">
      <div class="scope-h cond"><span>Kanon</span><span class="n">${
        ov.canon.worlds + ov.canon.characters + ov.canon.locations}</span></div>
      <div class="scope-note">Per univers · deles av alle versjoner</div>
      ${[['worlds', 'Verdener', ov.canon.worlds],
         ['characters', 'Karakterer', ov.canon.characters],
         ['locations', 'Lokasjoner', ov.canon.locations]].map(([k, l, n]) => `
        <div class="it ${s.kind === 'canon' && s.pid === k ? 'sel' : ''}" data-pick="canon" data-pid="${k}">
          <span>${l}</span><span class="count">${n}</span></div>`).join('')}
    </div>

    <div class="scope">
      <div class="scope-h cond"><span>Bøker</span><span class="n">1</span></div>
      <div class="scope-note">Per bok · versjon som bryter</div>
      <div class="it sel" style="border-left-color:var(--ac)"><span>${esc(g.title)}</span></div>
      <div class="verselect">
        <select id="verpick" aria-label="Versjon">
          ${g.versions.map(v => `
            <option value="${v.public_id}" data-label="${v.version_label}"
              ${v.public_id === A.state.bookPid ? 'selected' : ''}>${v.version_label} — ${
              v.chapter_count} kap${v.word_count ? ' · ' + fmtNum(v.word_count) + ' ord' : ''}</option>`).join('')}
        </select>
        <div class="vmeta">${g.versions.length} versjoner · versjon bryter, kanon står</div>
      </div>
      <div class="grp cond">Kapitler · ${D.chapters.length}</div>
      ${shown.map(c => `
        <div class="it sub ${s.kind === 'chapter' && s.pid === c.public_id ? 'sel' : ''}"
             data-pick="chapter" data-pid="${c.public_id}">
          <span>${c.order_index} · ${esc(c.title)}</span>
          ${c.flags.map(f => `<span class="tag ${f.tone}">${f.label}</span>`).join('')}
        </div>`).join('')}
      ${rest > 0 ? `<div class="it sub muted" data-expand-chapters><span>+ ${rest} til</span></div>` : ''}
      ${!D.chapters.length ? '<div class="scope-note" style="padding:8px 22px">Ingen kapitler i denne versjonen.</div>' : ''}
      <div class="grp cond">Plot</div>
      <div class="it sub ${s.kind === 'acts' ? 'sel' : ''}" data-pick="acts" data-pid="acts">
        <span>Akter</span><span class="count">${D.canon.acts.length}</span></div>
    </div>`;
}

/* ─────────── senter ─────────── */

/* Rad + skjult full tekst. Alt som er avkortet skal kunne apnes. */
function expandRow({ name, meta, body, label, attrs = '' }) {
  const more = body && body.trim().length > 0;
  return `<div class="row ${more ? 'has-more' : ''}" ${attrs}>
      <span class="nm">${esc(name)}</span>
      ${meta ? `<span class="src">${esc(meta)}</span>` : ''}
    </div>
    ${more ? `<div class="rowbody" hidden>${label ? `<span class="lbl">${esc(label)}</span>` : ''}${esc(body)}</div>` : ''}`;
}

const head = (crumb, title, badges, sub) => `<div class="mh">
  <div class="crumb">${crumb}</div>
  <div class="mt">${title}${badges || ''}</div>
  ${sub ? `<div class="msub">${sub}</div>` : ''}</div>`;

async function paintCenter() {
  const s = sel();
  try {
    if (s.kind === 'chapter') return await viewChapter(s.pid);
    if (s.kind === 'canon')   return viewCanon(s.pid);
    if (s.kind === 'source')  return await viewSource(s.pid);
    if (s.kind === 'acts')    return viewActs();
    return await viewAuthor(s.pid);
  } catch (e) {
    console.error(e);
    A.els.main.innerHTML = head('Library', 'Klarte ikke å hente', '', esc(e.message));
    A.els.ctx.innerHTML = '';
  }
}

/* ---- forfatter: greenfield ---- */
async function viewAuthor(pid) {
  if (!D.authors.length || pid === 'none') {
    A.els.main.innerHTML = head('Forfattere', 'Ingen forfatter komponert', '',
      'Kildene er minet. Stemmen som skal skrives mot finnes ikke ennå.') + `
      <div class="mb">
        <div class="sec"><div class="sech cond">Tilgjengelige kilder</div>
          <div class="rowlist">${D.sources.map(s => `
            <div class="row" data-pick="source" data-pid="${s.public_id}">
              <span class="nm">${esc(s.name)}</span>
              <span class="src">${s.aspects.filter(a => a.status === 'mined').length} av ${s.aspects.length} aspekter</span>
            </div>`).join('')}</div>
        </div>
        <div class="sec"><div class="sech cond">Hva som mangler</div>
          <div class="empty">En forfatter er en komposisjon av kilder til regler med betingelse —
            <span class="mono">alltid</span> · <span class="mono">når</span> · <span class="mono">aldri</span>.<br>
            Komposisjonen gjøres gjennom dialog i Author, ikke som skjema her.
            <br><button class="btn go" data-open-author>Komponer i Author</button></div>
        </div>
      </div>`;
    A.els.ctx.innerHTML = `
      <div class="blk"><div class="bl cond">Substrat</div>
        <div class="kr"><span class="kk">lorecore_author_profiles</span><span class="kv ok">${D.sources.length}</span></div>
        <div class="kr"><span class="kk">lore_authors</span><span class="kv bad">finnes ikke</span></div>
        <div class="kr"><span class="kk">lore_author_rules</span><span class="kv bad">finnes ikke</span></div>
        <div class="hint">Kilde-laget er ferdig minet. Forfatter-laget er ikke bygget.</div></div>`;
    return;
  }
  const a = await store.author(pid);
  A.els.main.innerHTML = head('Forfattere', esc(a.name), '', esc(a.description || '')) +
    `<div class="mb"><div class="empty">Regelvisning kommer når lore_author_rules finnes.</div></div>`;
  A.els.ctx.innerHTML = '';
}

/* ---- kapittel: scene-plan mot prosa ---- */
async function viewChapter(pid) {
  const c = await store.chapter(pid);
  const b = c.brief;
  const badges = [
    !b ? '<span class="badge warn">mangler brief</span>' : '',
    !c.has_prose ? '<span class="badge warn">ingen prosa</span>' : '',
  ].join('');

  A.els.main.innerHTML = head(
    `Galdurdal Book 1 / ${A.state.versionLabel}`,
    `Kapittel ${c.order_index} — ${esc(c.title)}`, badges,
    `POV ${esc(c.pov || '—')}${b ? ` · akt ${b.act} · ${esc(b.timeline_marker || '')}` : ''} · ${fmtNum(c.word_count)} ord`) + `
    <div class="mb">
      <div class="sec"><div class="sech cond"><span>Kontrakt og prosa</span>
        ${b ? `<span class="src">${b.scene_count} scener planlagt · form: ${esc(b.shape || '—')}</span>` : ''}</div>
        <div class="split">
          <div class="pane"><div class="ptitle cond">Scene-plan</div>
            ${!b ? `<div class="empty">Ingen brief for kapittel ${c.order_index}.<br>
              Prosaen finnes, men kontrakten den skulle skrives mot mangler.
              <button class="btn go" data-run="briefs">Kjør brief-modulen</button></div>`
              : (b.scenes || []).map(s => `
                <div class="beat"><b>Scene ${s.slot}</b>${s.target_words ? ` · ${s.target_words} ord` : ''}
                  <div style="margin-top:4px">${esc(s.purpose || '')}</div>
                  ${s.sensory_anchor ? `<div class="src" style="margin-top:4px">${esc(s.sensory_anchor)}</div>` : ''}
                </div>`).join('')}
          </div>
          <div class="pane"><div class="ptitle cond">Prosa</div>
            ${c.has_prose ? `<div class="prose">${esc(c.prose_excerpt)}<span class="excerpt-end">Utdrag — ${
                 fmtNum(c.word_count)} ord i basen. Hele teksten krever GET /chapters/{pid}.</span></div>`
              : `<div class="empty">Ingen prosa lagret.
                 <button class="btn go" data-run="chapters">Kjør kapittel-modulen</button></div>`}
          </div>
        </div>
      </div>

      ${b && b.constraints?.length ? `
      <div class="sec"><div class="sech cond"><span>Absolutte begrensninger</span>
        <span class="src">aktive i dette kapittelet</span></div>
        <div class="voicebox">${b.constraints.map(k => `
          <div class="vrule"><span class="cond-tag never">aldri</span>
            <span class="mono">${esc(k)}</span></div>`).join('')}
        </div>
        <div class="hint">Dette er never-reglene i maskinlesbar form. QC måler mot dem.</div>
      </div>` : ''}

      ${b && (b.callbacks_to_plant?.length || b.callbacks_to_pay_off?.length) ? `
      <div class="sec"><div class="sech cond">Callbacks</div>
        <div class="rowlist">
          ${(b.callbacks_to_plant || []).map(x => `
            <div class="row"><span class="nm">${esc(x)}</span><span class="src">plantes</span></div>`).join('')}
          ${(b.callbacks_to_pay_off || []).map(x => `
            <div class="row"><span class="nm">${esc(x)}</span><span class="src" style="color:var(--gr)">innfris</span></div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;

  A.els.ctx.innerHTML = `
    ${b?.orphaned ? `
    <div class="blk"><div class="bl cond">Substrat-avvik</div>
      <div class="find"><div class="ft"><span>Brief er foreldreløs</span><span class="sev maj">større</span></div>
        <div class="fd">Raden har <span class="mono">book_public_id = NULL</span> og henger kun på biblioteket.
          Den joines på <span class="mono">chapter_n</span>, ikke på kapittelraden.</div></div></div>` : ''}
    <div class="blk"><div class="bl cond">Opphav</div>
      <div class="kr"><span class="kk">Run</span><span class="kv">${esc(c.pipeline_run_id || 'ingen')}</span></div>
      <div class="kr"><span class="kk">Status</span><span class="kv">${esc(c.status || '—')}</span></div>
      <div class="kr"><span class="kk">Verdikt</span><span class="kv ${
        c.verdict_score == null ? '' : (c.verdict_score < 80 ? 'bad' : 'ok')}">${
        c.verdict_score == null ? '—' : c.verdict_score}</span></div>
      <div class="kr"><span class="kk">Stemme</span><span class="kv">arvet</span></div></div>
    <div class="blk"><div class="bl cond">Kjør på dette kapittelet</div>
      <button class="btn go act" data-run="chapters">Skriv om kapittelet</button>
      <button class="btn act" data-open-qc>Se funn i QC</button></div>`;
}

/* ---- kanon ---- */
function viewCanon(which) {
  const k = D.canon;
  if (which === 'characters') {
    A.els.main.innerHTML = head(`Kanon / ${D.overview.library.universe_id}`, 'Karakterer', '',
      `${k.characters.length} karakterer · deles av alle versjoner`) + `
      <div class="mb">${k.characters.map(c => `
        <div class="sec"><div class="sech cond"><span>${esc(c.name)}</span>
          <span class="src">${esc(c.role || '')}${c.is_pre_planned ? ' · forhåndsplanlagt' : ''}</span></div>
          ${c.summary ? `<div class="voicebox" style="margin-bottom:8px"><div class="vrule"><span>${esc(c.summary)}</span></div></div>` : ''}
          <div class="rowlist">${expandRow({
            name: 'Stemme i prosa', meta: 'klikk for hele', body: c.traits || '', label: 'Traits',
          })}${c.goals ? expandRow({ name: 'Mål', meta: '', body: c.goals, label: 'Goals' }) : ''}</div>
        </div>`).join('')}</div>`;
    A.els.ctx.innerHTML = `
      <div class="blk"><div class="bl cond">R7 trenger et flagg</div>
        <div class="hint">Regelen «aldri primitivt lag i kald POV» krever et maskinlesbart
          <span class="mono">cold</span>-flagg. I dag er <span class="mono">traits</span> lang prosa.
          Enten egen kolonne, eller avledet ved mining.</div></div>`;
    return;
  }
  if (which === 'locations') {
    A.els.main.innerHTML = head(`Kanon / ${D.overview.library.universe_id}`, 'Lokasjoner', '',
      `${k.locations.length} fra research-substratet`) + `
      <div class="mb"><div class="rowlist">${k.locations.map(l => `
        <div class="row"><span class="nm">${esc(l.name)}</span>
          <span class="src">${esc(l.location_type || '')}${l.region ? ' · ' + esc(l.region) : ''}</span></div>`).join('')}
      </div></div>`;
    A.els.ctx.innerHTML = `<div class="blk"><div class="bl cond">Kilde</div>
      <div class="hint">Disse kommer fra <span class="mono">lore_library_locations</span> — research, ikke fiksjon.</div></div>`;
    return;
  }
  const tiers = {};
  k.worlds.forEach(w => (tiers[w.depth_tier || 'standard'] ||= []).push(w));
  A.els.main.innerHTML = head(`Kanon / ${D.overview.library.universe_id}`, 'Verdener', '',
    `${k.worlds.length} i fire dybdenivåer`) + `
    <div class="mb">${Object.entries(tiers).map(([t, ws]) => `
      <div class="sec"><div class="sech cond"><span>${t}</span><span class="src">${ws.length}</span></div>
        <div class="rowlist">${ws.map(w => expandRow({
            name: w.name, meta: w.canon_state || w.status || '',
            body: w.summary || '', label: 'Sammendrag',
          })).join('')}
        </div></div>`).join('')}</div>`;
  A.els.ctx.innerHTML = `
    <div class="blk"><div class="bl cond">Scope</div>
      <div class="hint">Kanon er per bibliotek. Bytter du versjon på boka, endres ikke dette.</div></div>
    <div class="blk"><div class="bl cond">Dybdenivå</div>
      ${Object.entries(tiers).map(([t, ws]) => `
        <div class="kr"><span class="kk">${t}</span><span class="kv">${ws.length}</span></div>`).join('')}
      <div class="hint"><span class="mono">hidden_canon</span> er lag som aldri skal bli eksplisitt i teksten.</div></div>`;
}

/* ---- kilde ---- */
async function viewSource(pid) {
  const s = await store.source(pid);
  const mined = s.aspects.filter(a => a.status === 'mined');
  A.els.main.innerHTML = head('Kilder', esc(s.name), '',
    `${s.works.length} verk · ${mined.length} av ${s.aspects.length} aspekter minet · ${fmtNum(s.observation_count)} observasjoner`) + `
    <div class="mb">
      <div class="sec"><div class="sech cond">Uttrukne trekk</div>
        <div class="voicebox">${mined.map(a => `
          <div class="vrule"><span class="rulekey">${a.short.slice(0, 4)}</span>
            <span><b style="color:var(--tx)">${esc(a.label)}</b> — ${esc(a.summary)}</span></div>`).join('')}
        </div></div>
      ${s.metrics_summary?.key_numbers ? `
      <div class="sec"><div class="sech cond">Målte tall</div>
        <div class="voicebox"><div class="vrule"><span>${esc(s.metrics_summary.key_numbers)}</span></div></div>
      </div>` : ''}
    </div>`;
  A.els.ctx.innerHTML = `
    <div class="blk"><div class="bl cond">Kilde</div>
      <div class="kr"><span class="kk">Verk</span><span class="kv">${s.works.length}</span></div>
      <div class="kr"><span class="kk">Ord totalt</span><span class="kv">${fmtNum(s.works.reduce((n, w) => n + (w.word_count || 0), 0))}</span></div>
      <div class="kr"><span class="kk">Observasjoner</span><span class="kv">${fmtNum(s.observation_count)}</span></div>
      <div class="kr"><span class="kk">Scope</span><span class="kv">globalt</span></div>
      <div class="hint">Kildetekst lagres ikke som prosa — kun uttrukne mønstre og målinger.</div></div>
    <button class="btn act" data-open-kilder>Åpne i Kilder</button>`;
}

/* ---- akter ---- */
function viewActs() {
  A.els.main.innerHTML = head(`Galdurdal Book 1 / ${A.state.versionLabel}`, 'Akter', '',
    `${D.canon.acts.length} akter`) + `
    <div class="mb">${D.canon.acts.map(a => `
      <div class="sec"><div class="sech cond"><span>Akt ${a.order_index} — ${esc(a.title || '')}</span>
        <span class="src">${esc(a.status || '')}</span></div>
        <div class="rowlist">
          ${a.summary ? expandRow({ name: 'Sammendrag', meta: 'klikk for hele', body: a.summary, label: 'Summary' }) : ''}
          ${a.act_summary && a.act_summary !== a.summary
            ? expandRow({ name: 'Akt-sammendrag', meta: '', body: a.act_summary, label: 'Act summary' }) : ''}
        </div>
      </div>`).join('')}</div>`;
  A.els.ctx.innerHTML = `<div class="blk"><div class="bl cond">Scope</div>
    <div class="hint">Akter ligger på biblioteket, ikke per versjon.</div></div>`;
}

/* ─────────── hendelser ─────────── */

function wire() {
  if (wired) return;
  wired = true;

  const pick = async el => {
    A.state.sel.library = { kind: el.dataset.pick, pid: el.dataset.pid };
    paintRail(); await paintCenter();
  };
  onClick(A.els.rail, '[data-pick]', pick);
  onClick(A.els.main, '[data-pick]', pick);

  onClick(A.els.rail, '[data-expand-chapters]', () => { expanded = true; paintRail(); });

  A.els.rail.addEventListener('change', async e => {
    const sl = e.target.closest('#verpick');
    if (!sl) return;
    const opt = sl.selectedOptions[0];
    A.setBook(sl.value, opt.dataset.label);
    D.chapters = await store.chapters(A.state.bookPid);
    expanded = false;
    if (sel().kind === 'chapter') A.state.sel.library = { kind: 'author', pid: 'none' };
    paintRail(); await paintCenter();
  });

  /* Utvidbare rader: klikk apner full tekst under raden. */
  const toggle = (root) => onClick(root, '.row.has-more', el => {
    const body = el.nextElementSibling;
    if (!body || !body.classList.contains('rowbody')) return;
    const open = !body.hasAttribute('hidden');
    if (open) { body.setAttribute('hidden', ''); el.classList.remove('open'); }
    else { body.removeAttribute('hidden'); el.classList.add('open'); }
  });
  toggle(A.els.main);

  const run = async el => {
    const c = sel().kind === 'chapter' ? sel().pid : null;
    const r = await store.startRun({ stage: el.dataset.run, book_public_id: A.state.bookPid,
      scope_kind: c ? 'chapter' : 'book', scope_pid: c || A.state.bookPid });
    toast(`Startet ${el.dataset.run} · ${r.public_id}`, 'ok');
    A.refreshRuns();
  };
  onClick(A.els.main, '[data-run]', run);
  onClick(A.els.ctx, '[data-run]', run);

  onClick(A.els.main, '[data-open-author]', () => A.go('author'));
  onClick(A.els.ctx, '[data-open-author]', () => A.go('author'));
  onClick(A.els.ctx, '[data-open-qc]', () => A.go('qc'));
  onClick(A.els.ctx, '[data-open-kilder]', () => A.go('kilder', { pid: sel().pid }));
}
