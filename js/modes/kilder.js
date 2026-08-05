/* LoreCore — Kilder.
   Kilder er lorecore_author_profiles + corpus_references.
   Aspekt = nøkkel i style_card_json. Taggen sier hva som er trukket ut. */

import { esc, onClick, toast, fmtNum, fmtDate } from '../transport.js';
import { store } from '../store.js';

let A = null, D = { sources: [] }, wired = false;
const sel = () => A.state.sel.kilder;

export async function render(app) {
  A = app;
  A.paintTop();
  D.sources = await store.sources();
  if (!D.sources.some(s => s.public_id === sel().pid)) sel().pid = D.sources[0]?.public_id;
  paintRail();
  await paintCenter();
  wire();
}

function paintRail() {
  const own = D.sources.filter(s => s.ownership === 'own');
  const client = D.sources.filter(s => s.ownership === 'client');
  const works = D.sources.reduce((n, s) => n + s.works.length, 0);

  const block = s => `
    <div class="au ${s.public_id === sel().pid ? 'on' : ''}" data-source="${s.public_id}">
      <span class="aun">${esc(s.name)}</span><span class="auc">${s.works.length}</span></div>
    ${s.public_id === sel().pid ? s.works.map(w => `
      <div class="bk"><span>${esc(w.title)}</span>
        <div class="tags">${(w.mined || []).slice(0, 4).map(t => `<span class="tg">${esc(t)}</span>`).join('')}
          ${(w.mined || []).length > 4 ? `<span class="tg">+${w.mined.length - 4}</span>` : ''}
          ${!(w.mined || []).length ? '<span class="tg none">ingen</span>' : ''}</div></div>`).join('') : ''}`;

  A.els.rail.innerHTML = `
    <div class="zt cond"><span>Materiale</span><span>${works} verk</span></div>
    <button class="btn up" data-upload>+ Last opp</button>
    <div class="own cond">Eget referansebibliotek</div>
    ${own.map(block).join('')}
    <div class="own cond">Kundemateriale</div>
    ${client.length ? client.map(block).join('')
      : '<div class="au"><span class="aun" style="color:var(--tx3)">Ingen oppdrag ennå</span></div>'}`;
}

async function paintCenter() {
  const s = await store.source(sel().pid);
  const mined = s.aspects.filter(a => a.status === 'mined');
  const missing = s.aspects.filter(a => a.status !== 'mined');
  const words = s.works.reduce((n, w) => n + (w.word_count || 0), 0);

  A.els.main.innerHTML = `
    <div class="mh">
      <div class="crumb">Kilder / ${s.ownership === 'own' ? 'eget referansebibliotek' : 'kundemateriale'}</div>
      <div class="mt">${esc(s.name)}</div>
      <div class="msub">${s.works.length} verk · ${fmtNum(words)} ord analysert ·
        ${mined.length} av ${s.aspects.length} aspekter · ${fmtNum(s.observation_count)} observasjoner</div>
    </div>
    <div class="mb">
      <div class="sec"><div class="sech cond"><span>Verk</span>
        <span class="brw">tagg = hva som er trukket ut</span></div>
        <div class="bl-list">${s.works.map(w => `
          <div class="br"><span class="brn">${esc(w.title)}</span>
            <span class="brw">${fmtNum(w.word_count)} ord</span>
            <div class="mined">${(w.mined || []).map(t => `<span class="tg">${esc(t)}</span>`).join('')}</div>
          </div>`).join('')}
        </div>
      </div>

      ${missing.length ? `
      <div class="gapbox"><b>Ikke minet ennå</b>
        ${missing.map(a => a.label).join(', ')} er ikke trukket ut fra dette materialet.
        Du trenger ikke laste opp noe på nytt for å hente dem.
      </div>` : `
      <div class="sec"><div class="empty" style="border-color:rgba(62,207,142,.3);color:var(--gr)">
        Alle ${s.aspects.length} aspekter er minet fra dette materialet.</div></div>`}

      <div class="sec"><div class="sech cond">Hva som er trukket ut</div>
        ${s.aspects.map(a => `
          <div class="aspect">
            <div class="ah"><span class="an">${esc(a.label)}</span>
              <span class="ast ${a.status === 'mined' ? '' : 'no'}">${a.status === 'mined' ? 'minet' : 'ikke minet'}</span></div>
            <div class="ab ${a.status === 'mined' ? '' : 'no'}">${esc(a.summary)}</div>
          </div>`).join('')}
      </div>

      ${s.metrics_summary?.key_numbers ? `
      <div class="sec"><div class="sech cond"><span>Målte tall</span>
        <span class="brw">${fmtNum(s.observation_count)} observasjoner</span></div>
        <div class="voicebox"><div class="vrule"><span>${esc(s.metrics_summary.key_numbers)}</span></div></div>
      </div>` : ''}

      ${s.runs.length ? `
      <div class="sec"><div class="sech cond">Siste kjøringer</div>
        ${s.runs.map(r => `
          <div class="runline"><span class="rn">${esc(r.label)}</span>
            <span class="rs ${r.status === 'running' ? 'now' : ''}">${
              r.status === 'running' ? 'kjører · ' + esc(r.progress_label || '') : fmtDate(r.started_at)}</span></div>`).join('')}
      </div>` : ''}
    </div>`;

  A.els.ctx.innerHTML = `
    ${missing.length ? `
    <div class="blk"><div class="bl cond">Miner mer fra dette</div>
      ${missing.slice(0, 3).map((a, i) => `
        <button class="btn ${i === 0 ? 'go' : ''} act" data-mine="${a.aspect_kind}">Miner ${esc(a.label.toLowerCase())}</button>`).join('')}
      <div class="hint">Materialet ligger allerede. Nye aspekter trekkes ut uten ny opplasting.</div>
    </div>` : ''}
    <div class="blk"><div class="bl cond">Brukt i</div>
      ${s.used_in.length ? s.used_in.map(u => `
        <div class="usedin"><b>${esc(u.name)}</b><br>${esc(u.role || '')}</div>`).join('')
        : `<div class="empty">Ingen forfatter bruker denne ennå.<br>
             Kilder blir til stemme først når de komponeres.
             <button class="btn" data-open-author>Komponer i Author</button></div>`}
      <div class="hint">Endrer du hva som er minet, oppdateres ikke forfatteren automatisk — den må komponeres på nytt.</div>
    </div>
    <div class="blk"><div class="bl cond">Materiale</div>
      <div class="kr"><span class="kk">Verk</span><span class="kv">${s.works.length}</span></div>
      <div class="kr"><span class="kk">Ord totalt</span><span class="kv">${fmtNum(words)}</span></div>
      <div class="kr"><span class="kk">Aspekter</span><span class="kv">${mined.length} av ${s.aspects.length}</span></div>
      <div class="kr"><span class="kk">Eierskap</span><span class="kv">${s.ownership === 'own' ? 'eget referansebibl.' : esc(s.client_ref || 'kunde')}</span></div>
      <div class="hint">Kildetekst lagres ikke som prosa — kun uttrukne mønstre og målinger.</div>
    </div>`;
}

function wire() {
  if (wired) return;
  wired = true;
  onClick(A.els.rail, '[data-source]', async el => {
    sel().pid = el.dataset.source; paintRail(); await paintCenter();
  });
  onClick(A.els.rail, '[data-upload]', () =>
    toast('Opplasting krever POST /api/lorecore/sources — ikke bygget.'));
  onClick(A.els.ctx, '[data-mine]', async el => {
    await store.mineAspect(sel().pid, el.dataset.mine);
    D.sources = await store.sources();
    await paintCenter();
    toast('Mining startet. Forfatteren oppdateres ikke automatisk.', 'ok');
  });
  onClick(A.els.ctx, '[data-open-author]', () => A.go('author'));
}
