/* LoreCore — Kilder.
   Taggen sier hva som er trukket ut, ikke at noe er det. Da synes hull.
   Ny mining oppdaterer ikke forfatteren automatisk. */

import { esc, onClick, toast, fmtNum, fmtDate } from '../transport.js';
import { store } from '../store.js';

let A = null;
let data = { sources: [] };
let wired = false;

const sel = () => A.state.sel.kilder;
const ASPECTS = () => store.aspectKinds();

export async function render(app) {
  A = app;
  A.paintTop();

  data.sources = await store.sources();
  if (!data.sources.some(s => s.public_id === sel().pid)) sel().pid = data.sources[0]?.public_id;

  paintRail();
  await paintCenter();
  wire();
}

/* ─────────── venstre: forfatter → bøker → tagg ─────────── */

function paintRail() {
  const own = data.sources.filter(s => s.ownership === 'own');
  const client = data.sources.filter(s => s.ownership === 'client');
  const totalWorks = data.sources.reduce((n, s) => n + s.works.length, 0);

  const block = s => `
    <div class="au ${s.public_id === sel().pid ? 'on' : ''}" data-source="${s.public_id}">
      <span class="aun">${esc(s.name)}</span><span class="auc">${s.works.length}</span></div>
    ${s.public_id === sel().pid ? s.works.map(w => `
      <div class="bk"><span>${esc(w.title)}</span>
        <div class="tags">
          ${(w.mined || []).map(t => `<span class="tg">${esc(t)}</span>`).join('')}
          ${(w.partial || []).map(t => `<span class="tg q">${esc(t)}?</span>`).join('')}
          ${!(w.mined || []).length ? '<span class="tg none">ingen</span>' : ''}
        </div></div>`).join('') : ''}`;

  A.els.rail.innerHTML = `
    <div class="zt cond"><span>Materiale</span><span>${totalWorks} bøker</span></div>
    <button class="btn up" data-upload>+ Last opp</button>
    <div class="own cond">Eget referansebibliotek</div>
    ${own.map(block).join('')}
    <div class="own cond">Kundemateriale</div>
    ${client.length ? client.map(block).join('')
      : '<div class="au"><span class="aun" style="color:var(--tx3)">Ingen oppdrag ennå</span></div>'}`;
}

/* ─────────── senter ─────────── */

async function paintCenter() {
  const s = await store.source(sel().pid);
  const kinds = ASPECTS();
  const mined = s.aspects.filter(a => a.status === 'mined');
  const missing = s.aspects.filter(a => a.status !== 'mined');
  const label = k => kinds.find(x => x.key === k)?.label || k;
  const totalWords = s.works.reduce((n, w) => n + w.word_count, 0);

  A.els.main.innerHTML = `
    <div class="mh">
      <div class="crumb">Kilder / ${s.ownership === 'own' ? 'eget referansebibliotek' : 'kundemateriale'}</div>
      <div class="mt">${esc(s.name)}</div>
      <div class="msub">${s.works.length} bøker · minet for ${mined.length} av ${s.aspects.length} mulige aspekter${
        s.used_in.length ? ` · brukt som ryggrad i ${esc(s.used_in[0].name)}` : ''}</div>
    </div>
    <div class="mb">
      <div class="sec"><div class="sech cond"><span>Bøker</span>
        <span class="brw">tagg = hva som er trukket ut</span></div>
        <div class="bl-list">${s.works.map(w => `
          <div class="br"><span class="brn">${esc(w.title)}</span>
            <span class="brw">${fmtNum(w.word_count)} ord</span>
            <div class="mined">
              ${(w.mined || []).map(t => `<span class="tg">${esc(t)}</span>`).join('')}
              ${(w.partial || []).map(t => `<span class="tg q">${esc(t)}?</span>`).join('')}
            </div></div>`).join('')}
        </div>
      </div>

      ${missing.length ? `
      <div class="gapbox"><b>Ikke minet ennå</b>
        ${missing.map(a => label(a.aspect_kind)).join(', ')} er ikke trukket ut fra dette materialet.
        Du trenger ikke laste opp noe på nytt for å hente dem.
      </div>` : ''}

      <div class="sec"><div class="sech cond">Hva som er trukket ut</div>
        ${s.aspects.map(a => `
          <div class="aspect">
            <div class="ah"><span class="an">${esc(label(a.aspect_kind))}</span>
              <span class="ast ${a.status === 'mined' ? '' : 'no'}">${
                a.status === 'mined' ? 'minet · ' + new Date(a.mined_at).toLocaleDateString('no-NO') : 'ikke minet'}</span></div>
            <div class="ab ${a.status === 'mined' ? '' : 'no'}">${renderSummary(a.summary)}</div>
          </div>`).join('')}
      </div>

      ${s.runs.length ? `
      <div class="sec"><div class="sech cond">Siste kjøringer</div>
        ${s.runs.map(r => `
          <div class="runline"><span class="rn">${esc(r.label)}</span>
            <span class="rs ${r.status === 'running' ? 'now' : ''}">${
              r.status === 'running' ? 'kjører · ' + esc(r.progress_label) : fmtDate(r.started_at) + ' · fullført'}</span>
            ${r.status === 'running' ? '<button class="btn sm" data-open-author>Se</button>' : ''}</div>`).join('')}
      </div>` : ''}
    </div>`;

  A.els.ctx.innerHTML = `
    ${missing.length ? `
    <div class="blk"><div class="bl cond">Miner mer fra dette</div>
      ${missing.slice(0, 3).map((a, i) => `
        <button class="btn ${i === 0 ? 'go' : ''} act" data-mine="${a.aspect_kind}">Miner ${label(a.aspect_kind).toLowerCase()}</button>`).join('')}
      <div class="hint">Materialet ligger allerede. Nye aspekter trekkes ut uten ny opplasting.</div>
    </div>` : ''}

    ${s.used_in.length ? `
    <div class="blk"><div class="bl cond">Brukt i</div>
      ${s.used_in.map(u => `
        <div class="usedin" data-open-author-obj="${u.public_id}"><b>${esc(u.name)}</b><br>${esc(u.role)}</div>`).join('')}
      <div class="hint">Én kilde kan brukes i flere forfattere. Endrer du hva som er minet, oppdateres ikke forfatteren automatisk — den må komponeres på nytt i Author.</div>
    </div>` : ''}

    <div class="blk"><div class="bl cond">Materiale</div>
      <div class="kr"><span class="kk">Bøker</span><span class="kv">${s.works.length}</span></div>
      <div class="kr"><span class="kk">Ord totalt</span><span class="kv">${fmtNum(totalWords)}</span></div>
      <div class="kr"><span class="kk">Aspekter minet</span><span class="kv">${mined.length} av ${s.aspects.length}</span></div>
      <div class="kr"><span class="kk">Eierskap</span><span class="kv">${s.ownership === 'own' ? 'eget referansebibl.' : esc(s.client_ref || 'kunde')}</span></div>
      <div class="hint">Kildetekst lagres ikke som prosa — kun uttrukne mønstre og målinger.</div>
    </div>`;
}

const renderSummary = t => esc(t).replace(/\{([^}]+)\}/g, '<span class="m">$1</span>');

/* ─────────── hendelser ─────────── */

function wire() {
  if (wired) return;
  wired = true;

  onClick(A.els.rail, '[data-source]', async el => {
    sel().pid = el.dataset.source;
    paintRail(); await paintCenter();
  });

  onClick(A.els.rail, '[data-upload]', () =>
    toast('Opplasting krever POST /api/lorecore/sources — ny tabell lore_sources, ikke bygget ennå.'));

  onClick(A.els.ctx, '[data-mine]', async el => {
    await store.mineAspect(sel().pid, el.dataset.mine);
    data.sources = await store.sources();
    await paintCenter();
    toast('Mining startet. Forfatteren oppdateres ikke automatisk — komponer på nytt i Author.', 'ok');
  });

  onClick(A.els.ctx, '[data-open-author-obj]', el =>
    A.go('library', { kind: 'author', pid: el.dataset.openAuthorObj }));
  onClick(A.els.main, '[data-open-author]', () => A.go('author'));
}
