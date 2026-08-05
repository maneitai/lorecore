/* LoreCore — Author.
   Tenkerommet. Modulkjøring skjer i samtalen. Ingen terminal.
   Ekstraksjon til kanon går gjennom gate, aldri automatisk. */

import { esc, onClick, toast, fmtDate } from '../transport.js';
import { store } from '../store.js';

let A = null;
let D = { sessions: [], messages: [], candidates: [], health: null };
let mode = 'committee';
let scopeKey = 'chapters';
let extractState = 'idle';
let wired = false;
const sel = () => A.state.sel.author;

export async function render(app) {
  A = app;
  A.paintTop();
  D.sessions = await store.sessions();
  const active = D.sessions.find(s => s.public_id === sel().sessionPid) || D.sessions[0] || null;
  sel().sessionPid = active?.public_id || null;

  const [messages, candidates, health] = await Promise.all([
    active ? store.sessionMessages(active.public_id) : [],
    active ? store.extractDryRun(active.public_id) : [],
    store.health(A.state.bookPid),
  ]);
  D.messages = messages; D.candidates = candidates; D.health = health;
  extractState = 'idle';

  paintRail();
  paintConversation(active);
  paintCtx();
  wire();
}

function paintRail() {
  A.els.rail.innerHTML = `
    <div class="zt cond"><span>Samtaler</span><span>${D.sessions.length}</span></div>
    <button class="btn newses" data-new-session>+ Ny samtale</button>
    ${D.sessions.length ? D.sessions.map(s => `
      <div class="ses ${s.public_id === sel().sessionPid ? 'on' : ''}" data-session="${s.public_id}">
        <div class="ses-t">${esc(s.title || 'Uten tittel')}</div>
        <div class="ses-m">${fmtDate(s.updated_at)}</div>
      </div>`).join('')
      : `<div class="scope-note" style="padding:12px 14px;line-height:1.6">
           Ingen samtaler på denne flaten ennå.<br>
           Sesjoner ligger i <span class="mono">chat_sessions</span> med
           <span class="mono">surface=lorecore</span>.</div>`}`;
}

function paintConversation(session) {
  const modes = store.deliberationModes();
  const hint = modes.find(m => m.key === mode)?.hint || '';
  A.els.main.innerHTML = `
    <div class="ctop">
      <span class="scopepill">${esc(session?.scope_label || A.state.versionLabel)}</span>
      <div class="deliberation">
        ${modes.map(m => `<button class="dopt ${m.key === mode ? 'on' : ''}" data-mode-pick="${m.key}">${m.label}</button>`).join('')}
      </div>
      <span class="dhint">${esc(hint)}</span>
      <div class="spacer"></div>
      <button class="btn sm" data-toggle-ctx>Kontekst</button>
    </div>
    <div class="stream" id="stream">${
      D.messages.length ? D.messages.map(renderItem).join('') : emptyStream()}</div>
    <div class="composer">
      <div class="cbox">
        <textarea class="cin" id="cin" placeholder="Tenk høyt. Enter for å sende."></textarea>
        <button class="btn go" style="height:38px" data-send>Send</button>
      </div>
      <div class="cmeta">Kontekst: ${esc(A.state.versionLabel)} · kanon ${esc(A.state.universeId)} ·
        modus <span class="mono">${mode}</span></div>
    </div>`;
  const st = document.getElementById('stream');
  if (st) st.scrollTop = st.scrollHeight;
}

function emptyStream() {
  const h = D.health || {};
  return `<div class="empty" style="max-width:560px;margin:40px auto;text-align:left;padding:22px">
    <div style="color:var(--tx);font-size:14px;margin-bottom:10px">Tenkerommet</div>
    <div style="line-height:1.7">Her diskuteres boka, og moduler kjøres på det som diskuteres.
      Skop-treet til høyre bestemmer nivå — hele kjeden, én modul, eller ett kapittel.</div>
    <div style="margin-top:16px;line-height:1.7;color:var(--tx3)">
      Streaming går mot <span class="mono">/api/lorecore/sessions/{id}/stream</span>,
      som allerede tar <span class="mono">mode</span> og <span class="mono">models</span>.
      Deliberasjonsvelgeren over er koblet til den parameteren.</div>
    ${h.without_brief ? `<div style="margin-top:16px;color:var(--am)">
      ${h.without_brief} kapitler mangler brief i denne versjonen.</div>` : ''}
  </div>`;
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
    <div class="rh"><span class="rn">${esc(r.label)}</span><span class="rs ${cls}">${esc(r.status_label || r.status)}</span></div>
    <div class="rb">${esc(r.body || '')}
      ${r.voters?.length ? `<div class="voters">${r.voters.map(v => `<span class="voter">${esc(v)}</span>`).join('')}</div>` : ''}</div>
    <div class="rfoot"><span class="note">${esc(r.note || '')}</span></div></div>`;
}

function paintCtx() {
  const tree = store.moduleTree();
  const h = D.health || {};
  const stateOf = k => {
    if (k === 'briefs') return h.without_brief ? 'gap' : 'ok';
    if (k === 'chapters') return h.without_prose ? 'gap' : 'ok';
    if (k === 'audit') return h.open_findings ? 'gap' : '';
    return '';
  };
  const detailOf = k => {
    if (k === 'briefs') return h.without_brief ? h.without_brief + ' mangler' : 'komplett';
    if (k === 'chapters') return h.without_prose ? h.without_prose + ' uskrevet' : h.chapters + ' kap';
    if (k === 'audit') return h.open_findings ? h.open_findings + ' funn' : 'aldri kjørt';
    return 'venter';
  };

  A.els.ctx.innerHTML = `
    <div class="blk">
      <div class="bl cond"><span>Kjør</span><span>velg nivå</span></div>
      <div class="tree">
        <div class="tn ${scopeKey === 'full' ? 'sel' : ''}" data-scope="full">
          <span class="tl">Full bok-pipeline</span><span class="tst">${tree.length} moduler</span></div>
        ${tree.map(n => `
          <div class="tn tind${n.depth} ${scopeKey === n.key ? 'sel' : ''}" data-scope="${n.key}">
            <span class="tl">${esc(n.label)}</span>
            <span class="tst ${stateOf(n.key)}">${detailOf(n.key)}</span></div>`).join('')}
      </div>
      <button class="btn go runbtn" data-run-scope>Kjør valgt nivå</button>
      <div class="scopenote">Går mot <span class="mono">POST /books/{pid}/run-stage</span>.
        Samme modul på alle nivåer.</div>
    </div>

    <div class="blk">
      <div class="bl cond">Aktiv kontekst</div>
      <div class="kr"><span class="kk">Versjon</span><span class="kv">${esc(A.state.versionLabel)}</span></div>
      <div class="kr"><span class="kk">Forfatter</span><span class="kv bad">ingen</span></div>
      <div class="kr"><span class="kk">Kanon</span><span class="kv">${esc(A.state.universeId)}</span></div>
      <div class="hint">Uten komponert forfatter skrives det mot kanon alene — ingen språkregler å verifisere mot.</div>
    </div>

    <div class="blk">
      <div class="bl cond">Fra samtale til kanon</div>
      ${renderExtract()}
    </div>`;
}

const KIND = { fact: 'fakta', decision: 'beslutning', requirement: 'krav', finding: 'funn' };
const TARGET = { canon: 'kanon', author: 'forfatter', book: 'bok', none: 'notat' };

function renderExtract() {
  if (extractState === 'writing')
    return `<div class="extract"><div class="ex-t">Skriver til substrat</div>
      <div class="ex-d">Persist-agent i transaction. Verifiserer at raden landet før commit.</div></div>`;
  if (extractState === 'verified')
    return `<div class="extract"><div class="ex-t">Bekreftet</div>
      <div class="ex-d">Radene er skrevet og verifisert.</div>
      <button class="btn" style="width:100%" data-open-library>Se i Library</button></div>`;
  if (!D.candidates.length)
    return `<div class="empty">Ingenting å lagre fra denne samtalen.
      <button class="btn" data-audit-session>Audit samtalen</button>
      <div class="hint" style="margin-top:8px">Krever <span class="mono">extract</span> med
        <span class="mono">dry_run</span>. I dag skriver den direkte.</div></div>`;
  return `<div class="extract">
    <div class="ex-t">${D.candidates.length} ting kan lagres</div>
    <div class="ex-d">Funnet i samtalen, ikke skrevet ennå.</div>
    <div class="ex-items">${D.candidates.map(c => `
      <label class="ex-i"><input type="checkbox" data-cand="${c.id}" ${c.checked ? 'checked' : ''} />
        <span>${esc(c.label)}</span>
        <span class="ex-kind">${KIND[c.kind] || c.kind} → ${TARGET[c.target] || c.target}</span></label>`).join('')}</div>
    <button class="btn go" style="width:100%" data-persist>Lagre til kanon</button></div>`;
}

function wire() {
  if (wired) return;
  wired = true;

  onClick(A.els.rail, '[data-session]', async el => { sel().sessionPid = el.dataset.session; await render(A); });
  onClick(A.els.rail, '[data-new-session]', () =>
    toast('Ny samtale krever scope-feltene på POST /api/chat-sessions.'));

  onClick(A.els.main, '[data-mode-pick]', el => {
    mode = el.dataset.modePick;
    paintConversation(D.sessions.find(x => x.public_id === sel().sessionPid));
  });
  onClick(A.els.main, '[data-send]', send);
  A.els.main.addEventListener('keydown', e => {
    if (e.target.id === 'cin' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  onClick(A.els.ctx, '[data-scope]', el => { scopeKey = el.dataset.scope; paintCtx(); });
  onClick(A.els.ctx, '[data-run-scope]', async () => {
    const r = await store.startRun({ stage: scopeKey, book_public_id: A.state.bookPid,
      scope_kind: 'book', scope_pid: A.state.bookPid });
    toast(`Startet ${scopeKey} · ${r.public_id}`, 'ok');
    A.refreshRuns();
  });
  onClick(A.els.ctx, '[data-audit-session]', async () => {
    D.candidates = await store.extractDryRun(sel().sessionPid);
    paintCtx();
    toast(D.candidates.length ? 'Fant kandidater — ingenting skrevet.' : 'Ingen kandidater.');
  });
  A.els.ctx.addEventListener('change', e => {
    const cb = e.target.closest('[data-cand]');
    if (!cb) return;
    const c = D.candidates.find(x => x.id === cb.dataset.cand);
    if (c) c.checked = cb.checked;
  });
  onClick(A.els.ctx, '[data-persist]', async () => {
    const ids = D.candidates.filter(c => c.checked).map(c => c.id);
    if (!ids.length) return toast('Ingenting huket av.');
    extractState = 'writing'; paintCtx();
    try {
      const res = await store.persistCandidates(sel().sessionPid, ids);
      D.candidates = await store.extractDryRun(sel().sessionPid);
      extractState = 'verified'; paintCtx();
      toast(`${res.verified} rader skrevet og verifisert`, 'ok');
    } catch (e) { extractState = 'idle'; paintCtx(); toast('Avvist: ' + e.message, 'bad'); }
  });
  onClick(A.els.ctx, '[data-open-library]', () => A.go('library', { kind: 'canon', pid: 'characters' }));
}

function send() {
  const box = document.getElementById('cin');
  const text = box.value.trim();
  if (!text) return;
  D.messages.push({ kind: 'message', role: 'user', content: text });
  D.messages.push({ kind: 'message', role: 'assistant',
    content: 'Streaming er ikke koblet i denne flaten ennå. Endepunktet finnes: '
           + 'GET /api/lorecore/sessions/{id}/stream?prompt=&mode=' + mode + '&models=' });
  paintConversation(D.sessions.find(x => x.public_id === sel().sessionPid));
}
