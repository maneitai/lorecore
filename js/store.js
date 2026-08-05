/* LoreCore — store.
   ══════════════════════════════════════════════════════════════════
   BYTTEPUNKTET. Ingen komponent kaller fetch. Alle kaller store.
   Når backend står ferdig: sett SOURCE='live'. Ingen annen fil røres.

   Hver metode har endepunktet den skal treffe i kommentaren over seg.
   Den lista ER backend-arbeidsordren.
   ══════════════════════════════════════════════════════════════════ */

import { api } from './transport.js';
import * as F from './fixtures.js';

export const SOURCE = new URLSearchParams(location.search).get('live') ? 'live' : 'fixtures';

const clone = v => structuredClone(v);
const wait  = (v, ms = 90) => new Promise(r => setTimeout(() => r(clone(v)), ms));

/* Muterbar kopi i fixture-modus, så avhuking og lukking oppfører seg
   som ekte skriv innenfor økta. */
const local = {
  findings: clone(F.findings),
  sources: clone(F.sources),
  overrides: clone(F.voiceOverrides),
  candidates: clone(F.extractCandidates),
  passes: clone(F.passes),
};

export const store = {

  /* GET /api/lorecore/overview?library_public_id= */
  async overview(libraryPid) {
    if (SOURCE === 'live') return api(`/api/lorecore/overview?library_public_id=${libraryPid || ''}`);
    return wait(F.overview);
  },

  /* GET /api/lorecore/chapters?book_public_id= */
  async chapters(bookPid) {
    if (SOURCE === 'live') return api(`/api/lorecore/chapters?book_public_id=${bookPid}`);
    return wait(F.chaptersByBook[bookPid] || []);
  },

  /* GET /api/lorecore/chapters/{pid} — brief parset til scenes[] server-side */
  async chapter(pid) {
    if (SOURCE === 'live') return api(`/api/lorecore/chapters/${pid}`);
    const hit = F.chapterDetail[pid];
    if (hit) return wait(hit);
    const row = (F.chaptersByBook['LBK-GALDV31D'] || []).find(c => c.public_id === pid);
    if (!row) throw new Error('Fant ikke kapittelet');
    return wait({
      ...row, scenes: [], voice: { author_public_id: 'AUT-GALDURDAL', inherited: true, override: null },
      written_by: ['Kimi', 'gpt-oss', 'GLM'], synthesized_by: 'GLM', canon_check: 'passed',
      pipeline_run_id: 'PLR-V31D-11' + row.order_index,
    });
  },

  /* GET /api/lorecore/authors  ·  GET /api/lorecore/authors/{pid} */
  async authors() {
    if (SOURCE === 'live') return api('/api/lorecore/authors');
    return wait(F.authors);
  },
  async author(pid) {
    if (SOURCE === 'live') return api(`/api/lorecore/authors/${pid}`);
    const a = F.authors.find(x => x.public_id === pid);
    if (!a) throw new Error('Fant ikke forfatteren');
    return wait(a);
  },

  /* GET /api/lorecore/voice-overrides?author_public_id= */
  async overrides(authorPid) {
    if (SOURCE === 'live') return api(`/api/lorecore/voice-overrides?author_public_id=${authorPid}`);
    return wait(local.overrides.filter(o => o.author_public_id === authorPid));
  },

  /* DELETE /api/lorecore/voice-overrides/{pid} */
  async removeOverride(pid) {
    if (SOURCE === 'live') return api(`/api/lorecore/voice-overrides/${pid}`, { method: 'DELETE' });
    local.overrides = local.overrides.filter(o => o.public_id !== pid);
    return wait({ ok: true });
  },

  /* GET /api/lorecore/canon?universe_id= */
  async canon(universeId) {
    if (SOURCE === 'live') return api(`/api/lorecore/canon?universe_id=${universeId}`);
    return wait(F.canon);
  },

  /* GET /api/lorecore/sources  ·  GET /api/lorecore/sources/{pid} */
  async sources() {
    if (SOURCE === 'live') return api('/api/lorecore/sources');
    return wait(local.sources);
  },
  async source(pid) {
    if (SOURCE === 'live') return api(`/api/lorecore/sources/${pid}`);
    const s = local.sources.find(x => x.public_id === pid);
    if (!s) throw new Error('Fant ikke kilden');
    return wait(s);
  },

  /* POST /api/lorecore/sources/{pid}/mine  {aspect_kind} */
  async mineAspect(pid, aspectKind) {
    if (SOURCE === 'live') return api(`/api/lorecore/sources/${pid}/mine`, { method: 'POST', body: { aspect_kind: aspectKind } });
    const s = local.sources.find(x => x.public_id === pid);
    const label = F.ASPECT_KINDS.find(a => a.key === aspectKind)?.label || aspectKind;
    s.runs.unshift({ public_id: 'PLR-MINE-' + Date.now().toString().slice(-4),
      label: `Miner ${label.toLowerCase()} · ${s.works.length} bøker`, status: 'running',
      progress_label: 'bok 1 av ' + s.works.length, started_at: new Date().toISOString() });
    return wait({ ok: true });
  },

  /* GET /api/lorecore/findings?book_public_id=&status= */
  async findings(bookPid, status = 'open') {
    if (SOURCE === 'live') return api(`/api/lorecore/findings?book_public_id=${bookPid}&status=${status}`);
    return wait(local.findings.filter(f => f.book_public_id === bookPid && (status === 'all' || f.status === status)));
  },

  /* POST /api/lorecore/findings/{pid}/override  {reason}
     Verifieren lukker normalt. Operatør-overstyring krever grunn og merkes. */
  async overrideFinding(pid, reason) {
    if (SOURCE === 'live') return api(`/api/lorecore/findings/${pid}/override`, { method: 'POST', body: { reason } });
    const f = local.findings.find(x => x.public_id === pid);
    if (f) { f.status = 'closed'; f.closed_by = 'operator'; f.override_reason = reason; f.closed_at = new Date().toISOString(); }
    return wait({ ok: true });
  },

  /* GET /api/lorecore/qc/metrics?book_public_id= */
  async metrics(bookPid) {
    if (SOURCE === 'live') return api(`/api/lorecore/qc/metrics?book_public_id=${bookPid}`);
    return wait(F.metrics);
  },

  /* GET /api/lorecore/qc/passes?book_public_id= */
  async passes(bookPid) {
    if (SOURCE === 'live') return api(`/api/lorecore/qc/passes?book_public_id=${bookPid}`);
    return wait(local.passes);
  },

  /* POST /api/lorecore/qc/passes/run  {pass_key, book_public_id, scope} */
  async runPass(passKey, bookPid) {
    if (SOURCE === 'live') return api('/api/lorecore/qc/passes/run', { method: 'POST', body: { pass_key: passKey, book_public_id: bookPid } });
    const p = local.passes.find(x => x.key === passKey);
    if (p) { p.state = 'running'; p.detail = 'kjører · 3-way'; }
    return wait({ ok: true });
  },

  /* GET /api/lorecore/books/{pid}/health */
  async health(bookPid) {
    if (SOURCE === 'live') return api(`/api/lorecore/books/${bookPid}/health`);
    return wait(F.bookHealth);
  },

  /* GET /api/chat-sessions?surface=lorecore  ·  GET /api/chat-sessions/{id} */
  async sessions() {
    if (SOURCE === 'live') return api('/api/chat-sessions?surface=lorecore&limit=30');
    return wait(F.sessions);
  },
  async sessionMessages(pid) {
    if (SOURCE === 'live') return (await api(`/api/chat-sessions/${pid}`)).messages || [];
    return wait(F.sessionMessages[pid] || []);
  },

  /* POST /api/lorecore/extract  {session_public_id, dry_run:true}
     KRITISK: dagens endepunkt skriver direkte. Gate-modellen krever
     kandidater med type + sitat + mål, uten skriv. */
  async extractDryRun(sessionPid) {
    if (SOURCE === 'live') return api('/api/lorecore/extract', { method: 'POST', body: { session_public_id: sessionPid, dry_run: true } });
    return wait(local.candidates[sessionPid] || []);
  },

  /* POST /api/lorecore/persist  {candidates:[...]}
     Generisk persist-agent: schema fra information_schema, FK-verifisering,
     transaction, verify-after-write. */
  async persistCandidates(sessionPid, ids) {
    if (SOURCE === 'live') return api('/api/lorecore/persist', { method: 'POST', body: { session_public_id: sessionPid, candidate_ids: ids } });
    const list = local.candidates[sessionPid] || [];
    local.candidates[sessionPid] = list.filter(c => !ids.includes(c.id));
    return wait({ written: ids.length, verified: ids.length, rejected: [] }, 700);
  },

  /* GET /api/lorecore/modules?book_public_id= */
  async moduleTree(bookPid) {
    if (SOURCE === 'live') return api(`/api/lorecore/modules?book_public_id=${bookPid}`);
    return wait(F.moduleTree);
  },

  /* POST /api/lorecore/runs  {module_key, scope_kind, scope_pid}
     Én motor, flere innganger: samme kall fra Author, Library og QC. */
  async startRun({ module_key, scope_kind, scope_pid }) {
    if (SOURCE === 'live') return api('/api/lorecore/runs', { method: 'POST', body: { module_key, scope_kind, scope_pid } });
    return wait({ public_id: 'PLR-' + Date.now().toString().slice(-6), status: 'queued' }, 400);
  },

  /* GET /api/lorecore/runs?status=active */
  async activeRuns() {
    if (SOURCE === 'live') return api('/api/lorecore/runs?status=active');
    return wait(F.activeRuns);
  },

  deliberationModes: () => clone(F.deliberationModes),
  aspectKinds: () => clone(F.ASPECT_KINDS),
};
