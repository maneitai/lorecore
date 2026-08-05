/* LoreCore — Author.
   Tenkerommet. Modulkjøring skjer i samtalen, på det som diskuteres.
   Ingen terminal. Ekstraksjon til kanon går gjennom gate, aldri automatisk. */

import { esc, onClick, toast, fmtDate } from '../transport.js';
import { store } from '../store.js';

let A = null;
let data = { sessions: [], messages: [], tree: null, candidates: [] };
let mode = 'committee';
let scopeKey = 'ch13';
let extractState = 'idle';   // idle | writing | verified | rejected
let wired = false;

const sel = () => A.state.sel.author;

export async function render(app) {
  A = app;
  A.paintTop();

  data.sessions = await store.sessions();
  const active = data.sessions.find(s => s.public_id === sel().sessionPid) || data.sessions[0];
  sel().sessionPid = active.public_id;
  mode = active.deliberation_mode || 'committee';

  const [messages, tree, candidates] = await Promise.all([
    store.sessionMessages(active.public_id),
    store.moduleTree(A.state.bookPid),
    store.extractDryRun(active.public_id),
  ]);
  data.messages = messages; data.tree = tree; data.candidates = candidates;
  extractState = 'idle';

  paintRail();
  paintConversation(active);
  paintCtx();
  wire();
}

/* ─────────── venstre: samtaler ─────────── */

function paintRail() {
  A.els.rail.innerHTML = `
    <div class="zt cond"><span>Samtaler</span><span>${data.sessions.length}</span></div>
    <button class="btn newses" data-new-session>+ Ny samtale</button>
    ${data.sessions.map(s => `
      <div class="ses ${s.public_id === sel().sessionPid ? 'on' : ''}" data-session="${s.public_id}">
        <div class="ses-t">${esc(s.title)}${s.persisted ? '<span class="ses-tag">lagret</span>' : ''}</div>
        <div class="ses-m">${s.scope_kind === 'none' ? esc(s.scope_label) : fmtDate(s.updated_at)}</div>
      </div>`).join('')}`;
}

/* ─────────── senter: samtalen ─────────── */

function paintConversation(session) {
  const modes = store.deliberationModes();
  const hint = modes.find(m => m.key === mode)?.hint || '';

  A.els.main.innerHTML = `
    <div class="ctop">
      <span class="scopepill">${esc(session.scope_label)}</span>
      <div class="deliberation">
        ${modes.map(m => `<button class="dopt ${m.key === mode ? 'on' : ''}" data-mode-pick="${m.key}">${m.label}</button>`).join('')}
      </div>
      <span class="dhint">${esc(hint)}</span>
      <div class="spacer"></div>
      <button class="btn sm" data-toggle-ctx>Kontekst</button>
    </div>

    <div class="stream" id="stream">${data.messages.map(renderItem).join('')}</div>

    <div class="composer">
      <div class="cbox">
        <textarea class="cin" id="cin" placeholder="Tenk høyt. Enter for å sende."></textarea>
        <button class="btn go" style="height:38px" data-send>Send</button>
      </div>
      <div class="cmeta">Kontekst: ${esc(session.scope_label.toLowerCase())} · Galdurdal-stemmen · kanon ${A.state.universeId}</div>
    </div>`;

  const st = document.getElementById('stream');
  if (st) st.scrollTop = st.scrollHeight;
}

function renderItem(m) {
  if (m.kind === 'run') return renderRun(m);
  return `<div class="msg ${m.role === 'user' ? 'me' : ''}">
    <div class="who cond">${m.role === 'user' ? 'Deg' : 'LoreCore'}</div>
    <div class="txt">${esc(m.content)}</div></div>`;
}

function renderRun(r) {
  const cls = r.status === 'running' ? 'run' : r.status === 'failed' ? 'fail' : 'ok';
  return `<div class="run">
    <div class="rh"><span class="rn">${esc(r.label)}</span>
      <span class="rs ${cls}">${esc(r.status_label)}</span></div>
    <div class="rb">${esc(r.body)}
      ${r.chips?.length ? `<div class="chips">${r.chips.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
      ${r.voters?.length ? `<div class="voters">${r.voters.map(v => `<span class="voter">${esc(v)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="rfoot"><span class="note">${esc(r.note || '')}</span>
      ${r.action ? `<button class="btn sm" data-run-action="${r.action.target}">${esc(r.action.label)}</button>` : ''}</div>
  </div>`;
}

/* ─────────── høyre: kjør · stemme · ekstraksjon ─────────── */

function paintCtx() {
  const t = data.tree;
  A.els.ctx.innerHTML = `
    <div class="blk">
      <div class="bl cond"><span>Kjør</span><span>velg nivå</span></div>
      <div class="tree">
        <div class="tn ${scopeKey === 'full' ? 'sel' : ''}" data-scope="full">
          <span class="tl">${esc(t.root.label)}</span><span class="tst">${esc(t.root.detail)}</span></div>
        ${t.nodes.map(n => `
          <div class="tn tind${n.depth} ${scopeKey === n.key ? 'sel' : ''}" data-scope="${n.key}">
            <span class="tl">${esc(n.label)}</span>
            <span class="tst ${n.state}">${esc(n.detail)}</span></div>`).join('')}
      </div>
      <button class="btn go runbtn" data-run-scope>Kjør valgt nivå</button>
      <div class="scopenote">Samme modul på alle nivåer. Velger du toppen går hele kjeden; velger du en scene går bare den.</div>
    </div>

    <div class="blk">
      <div class="bl cond">Aktiv stemme</div>
      <div class="kr"><span class="kk">Forfatter</span><span class="kv">Galdurdal</span></div>
      <div class="kr"><span class="kk">Kapittel 13</span><span class="kv ovr">overstyrt</span></div>
      <div class="kr"><span class="kk">Kanon</span><span class="kv">${A.state.universeId}</span></div>
    </div>

    <div class="blk">
      <div class="bl cond">Fra samtale til kanon</div>
      ${renderExtract()}
    </div>`;
}

const KIND_LABEL = { fact: 'fakta', decision: 'beslutning', requirement: 'krav', finding: 'funn' };
const TARGET_LABEL = { canon: 'kanon', author: 'forfatter', book: 'bok', none: 'notat' };

function renderExtract() {
  if (extractState === 'writing') {
    return `<div class="extract"><div class="ex-t">Skriver til substrat</div>
      <div class="ex-d">Persist-agent kjører i transaction. Verifiserer at raden faktisk landet før commit.</div></div>`;
  }
  if (extractState === 'verified') {
    return `<div class="extract"><div class="ex-t">Bekreftet</div>
      <div class="ex-d">Radene er skrevet og verifisert. De vises nå i Library under kanon.</div>
      <button class="btn" style="width:100%" data-open-library>Se i Library</button></div>`;
  }
  if (!data.candidates.length) {
    return `<div class="empty">Ingenting funnet å lagre i denne samtalen ennå.
      <button class="btn" data-audit-session>Audit samtalen</button></div>`;
  }
  return `<div class="extract">
    <div class="ex-t">${data.candidates.length} ting kan lagres</div>
    <div class="ex-d">Funnet i denne samtalen, ikke skrevet til substrat ennå.</div>
    <div class="ex-items">${data.candidates.map(c => `
      <label class="ex-i" title="${esc(c.quote)}">
        <input type="checkbox" data-cand="${c.id}" ${c.checked ? 'checked' : ''} />
        <span>${esc(c.label)}</span>
        <span class="ex-kind">${KIND_LABEL[c.kind]} → ${TARGET_LABEL[c.target]}</span>
      </label>`).join('')}</div>
    <button class="btn go" style="width:100%" data-persist>Lagre til kanon</button>
  </div>`;
}

/* ─────────── hendelser ─────────── */

function wire() {
  if (wired) return;
  wired = true;

  onClick(A.els.rail, '[data-session]', async el => {
    sel().sessionPid = el.dataset.session;
    await render(A);
  });
  onClick(A.els.rail, '[data-new-session]', () =>
    toast('Ny samtale krever POST /api/chat-sessions — finnes, men scope-feltene mangler ennå.'));

  onClick(A.els.main, '[data-mode-pick]', el => {
    mode = el.dataset.modePick;
    const s = data.sessions.find(x => x.public_id === sel().sessionPid);
    paintConversation(s);
  });

  onClick(A.els.main, '[data-send]', () => send());
  A.els.main.addEventListener('keydown', e => {
    if (e.target.id === 'cin' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  onClick(A.els.main, '[data-run-action]', el => {
    const [verb, pid] = el.dataset.runAction.split(':');
    if (verb === 'library') return A.go('library', { kind: 'chapter', pid });
    if (verb === 'cancel')  return toast('Avbryt krever POST /api/lorecore/runs/' + pid + '/cancel — ikke bygget.');
  });

  onClick(A.els.ctx, '[data-scope]', el => {
    scopeKey = el.dataset.scope;
    paintCtx();
  });

  onClick(A.els.ctx, '[data-run-scope]', async () => {
    const node = data.tree.nodes.find(n => n.key === scopeKey);
    const r = await store.startRun({
      module_key: node ? node.key : 'full',
      scope_kind: node?.scope_pid ? 'chapter' : 'book',
      scope_pid: node?.scope_pid || A.state.bookPid,
    });
    toast(`Startet ${node ? node.label : 'full bok-pipeline'} · ${r.public_id}`, 'ok');
    A.refreshRuns();
  });

  onClick(A.els.ctx, '[data-audit-session]', async () => {
    data.candidates = await store.extractDryRun(sel().sessionPid);
    paintCtx();
    toast(data.candidates.length ? 'Fant kandidater — ingenting skrevet.' : 'Ingen kandidater funnet.');
  });

  A.els.ctx.addEventListener('change', e => {
    const cb = e.target.closest('[data-cand]');
    if (!cb) return;
    const c = data.candidates.find(x => x.id === cb.dataset.cand);
    if (c) c.checked = cb.checked;
  });

  onClick(A.els.ctx, '[data-persist]', async () => {
    const ids = data.candidates.filter(c => c.checked).map(c => c.id);
    if (!ids.length) return toast('Ingenting huket av.');
    extractState = 'writing'; paintCtx();
    try {
      const res = await store.persistCandidates(sel().sessionPid, ids);
      data.candidates = await store.extractDryRun(sel().sessionPid);
      extractState = 'verified'; paintCtx();
      toast(`${res.verified} rader skrevet og verifisert`, 'ok');
    } catch (e) {
      extractState = 'idle'; paintCtx();
      toast('Avvist: ' + e.message, 'bad');
    }
  });

  onClick(A.els.ctx, '[data-open-library]', () => A.go('library', { kind: 'canon', pid: 'characters' }));
}

function send() {
  const box = document.getElementById('cin');
  const text = box.value.trim();
  if (!text) return;
  data.messages.push({ kind: 'message', role: 'user', content: text });
  data.messages.push({ kind: 'message', role: 'assistant',
    content: 'Streaming krever GET /api/lorecore/sessions/{id}/stream. Endepunktet finnes; koblingen mot deliberasjonsmodus gjør ikke.' });
  const s = data.sessions.find(x => x.public_id === sel().sessionPid);
  paintConversation(s);
}
