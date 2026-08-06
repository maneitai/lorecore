/* LoreCore — store.
   ══════════════════════════════════════════════════════════════════
   BYTTEPUNKTET. Ingen komponent kaller fetch. Alle kaller store.

   Fixture-dataen er GENERERT FRA LIVE BASE (lorecore_dump_fixtures_v1.py).
   Formene under er derfor ekte, ikke antatt. Hver metode har ruta den
   skal treffe i kommentaren — den lista er backend-arbeidsordren.

   Ruter som ALLEREDE finnes er merket [finnes]. Resten må bygges.
   ══════════════════════════════════════════════════════════════════ */

import { api } from './transport.js';
import * as F from './fixtures.js';

export const SOURCE = new URLSearchParams(location.search).get('live') ? 'live' : 'fixtures';

const clone = v => structuredClone(v);
const wait  = (v, ms = 60) => new Promise(r => setTimeout(() => r(clone(v)), ms));

/* Live API returnerer ofte {items: [...]} — frontend forventer ren array. */
const unwrap = r => Array.isArray(r) ? r : (r?.items ?? r);

const local = {
  findings: clone(F.findings),
  sources: clone(F.sources),
  authors: clone(F.authors),
  overrides: [],
};

/* Severity-skalaen i basen er critical|major|minor|style.
   Status er open|applied|deferred|rejected. Det finnes ingen "closed". */
export const SEVERITY = {
  critical: { label: 'kritisk', cls: 'blk', rank: 0 },
  major:    { label: 'større',  cls: 'maj', rank: 1 },
  minor:    { label: 'mindre',  cls: 'min', rank: 2 },
  style:    { label: 'stil',    cls: 'min', rank: 3 },
};
export const FINDING_STATUS = {
  open:     { label: 'åpen',     closed: false },
  applied:  { label: 'utbedret', closed: true  },
  deferred: { label: 'utsatt',   closed: true  },
  rejected: { label: 'avvist',   closed: true  },
};

export const store = {

  /* [finnes] GET /api/lorecore/overview?library_public_id=&book_public_id=
     Må endres: returner tellinger + bokgruppe, ikke alle rader. */
  async overview() {
    if (SOURCE === 'live') {
      const r = await api(`/api/lorecore/overview?library_public_id=${F.library.public_id}`);
      /* Live API returnerer gammelt format — transformer til det frontend forventer. */
      const lib = r.selected_library || r.libraries?.[0] || {};
      const books = r.books || [];
      const selectedBook = r.selected_book || books[0] || null;
      /* Grupper bøker på book_group_id. */
      const groups = {};
      for (const b of books) {
        const gid = b.book_group_id || b.public_id;
        if (!groups[gid]) groups[gid] = { book_group_id: gid, title: b.title, versions: [] };
        groups[gid].versions.push(b);
      }
      const bookGroup = selectedBook
        ? groups[selectedBook.book_group_id || selectedBook.public_id]
        : Object.values(groups)[0] || { versions: [] };
      return {
        library: lib,
        book_group: bookGroup,
        canon: {
          worlds: (r.worlds || []).length,
          characters: (r.characters || []).length,
          locations: 0,
          acts: 0,
        },
        counts: {
          sources: 0,
          authors: 0,
          briefs: 0,
          open_findings: 0,
        },
        meta: F.meta,
        /* Behold raw-data for Library som trenger det. */
        _raw: r,
      };
    }
    return wait({
      library: F.library,
      book_group: F.bookGroup,
      canon: {
        worlds: F.canon.worlds.length,
        characters: F.canon.characters.length,
        locations: F.canon.locations.length,
        acts: F.canon.acts.length,
      },
      counts: {
        sources: F.sources.length,
        authors: F.authors.length,
        briefs: Object.keys(F.briefsByChapterN).length,
        open_findings: F.findings.filter(f => f.status === 'open').length,
      },
      meta: F.meta,
    });
  },

  /* [finnes] GET /api/lorecore/chapters?book_public_id=
     Må utvides med flags[] + pov + has_brief. */
  async chapters(bookPid) {
    if (SOURCE === 'live') return unwrap(await api(`/api/lorecore/chapters?book_public_id=${bookPid}`));
    return wait(F.chaptersByBook[bookPid] || []);
  },

  /* MANGLER: GET /api/lorecore/chapters/{pid}
     I dag finnes kun PUT. All lesing går via overview. */
  async chapter(pid) {
    if (SOURCE === 'live') return api(`/api/lorecore/chapters/${pid}`);
    const c = F.chapterDetail[pid];
    if (!c) throw new Error('Fant ikke kapittelet');
    return wait({ ...c, brief: c.brief_n ? F.briefsByChapterN[c.brief_n] : null });
  },

  /* MANGLER: GET /api/lorecore/briefs?library_public_id=
     32 rader, alle med book_public_id NULL — foreldrelose. */
  async briefs() {
    if (SOURCE === 'live') return unwrap(await api(`/api/lorecore/briefs?library_public_id=${F.library.public_id}`));
    return wait(F.briefsByChapterN);
  },

  /* MANGLER: GET /api/lorecore/canon?library_public_id= */
  async canon() {
    if (SOURCE === 'live') return api(`/api/lorecore/canon?library_public_id=${F.library.public_id}`);
    return wait(F.canon);
  },

  /* MANGLER: GET /api/lorecore/sources
     Leser lorecore_author_profiles + lorecore_corpus_references.
     Aspekt-nøklene ER nøklene i style_card_json. */
  async sources() {
    if (SOURCE === 'live') return unwrap(await api('/api/lorecore/sources'));
    return wait(local.sources);
  },
  async source(pid) {
    if (SOURCE === 'live') return api(`/api/lorecore/sources/${pid}`);
    const s = local.sources.find(x => x.public_id === pid);
    if (!s) throw new Error('Fant ikke kilden');
    return wait(s);
  },

  /* MANGLER: POST /api/lorecore/sources/{pid}/mine {aspect_kind} */
  async mineAspect(pid, aspectKind) {
    if (SOURCE === 'live') return api(`/api/lorecore/sources/${pid}/mine`, { method: 'POST', body: { aspect_kind: aspectKind } });
    const s = local.sources.find(x => x.public_id === pid);
    s.runs.unshift({ public_id: 'LARUN-' + Date.now().toString(36).toUpperCase(),
      label: 'Miner ' + aspectKind, status: 'running',
      progress_label: 'verk 1 av ' + s.works.length, started_at: new Date().toISOString() });
    return wait({ ok: true });
  },

  /* MANGLER HELT: lore_authors + lore_author_rules + lore_voice_overrides.
     style_card_json er kilde-nivå (funn per forfatter), ikke komponert stemme. */
  async authors() {
    if (SOURCE === 'live') return unwrap(await api('/api/lorecore/authors'));
    return wait(local.authors);
  },
  async author(pid) {
    if (SOURCE === 'live') return api(`/api/lorecore/authors/${pid}`);
    const a = local.authors.find(x => x.public_id === pid);
    if (!a) throw new Error('Fant ikke forfatteren');
    return wait(a);
  },
  async overrides(authorPid) {
    if (SOURCE === 'live') return unwrap(await api(`/api/lorecore/voice-overrides?author_public_id=${authorPid}`));
    return wait(local.overrides.filter(o => o.author_public_id === authorPid));
  },

  /* MANGLER: GET /api/lorecore/findings?book_public_id=&status=
     Tabellen lore_audit_findings finnes med ekte skjema. */
  async findings(bookPid, status = 'open') {
    if (SOURCE === 'live') return unwrap(await api(`/api/lorecore/findings?book_public_id=${bookPid}&status=${status}`));
    return wait(local.findings.filter(f =>
      (!bookPid || f.book_public_id === bookPid) && (status === 'all' || f.status === status)));
  },

  /* MANGLER: POST /api/lorecore/findings/{pid}/status {status, reason} */
  async setFindingStatus(pid, status, reason) {
    if (SOURCE === 'live') return api(`/api/lorecore/findings/${pid}/status`, { method: 'POST', body: { status, reason } });
    const f = local.findings.find(x => x.public_id === pid);
    if (f) { f.status = status; f.override_reason = reason; f.applied_at = new Date().toISOString(); }
    return wait({ ok: true });
  },

  /* Bokas helse — avledet, ikke eget endepunkt. */
  async health(bookPid) {
    const [chs, fnd] = await Promise.all([this.chapters(bookPid), this.findings(bookPid, 'open')]);
    const briefs = await this.briefs();
    return {
      book_public_id: bookPid,
      chapters: chs.length,
      without_brief: chs.filter(c => !c.has_brief).length,
      without_prose: chs.filter(c => c.flags?.some(f => f.kind === 'no_prose')).length,
      flagged: chs.filter(c => c.flags?.some(f => f.kind === 'low_verdict')).length,
      critical: fnd.filter(f => f.severity === 'critical').length,
      open_findings: fnd.length,
      briefs_orphaned: Object.values(briefs).filter(b => b.orphaned).length,
      publishable: false,
    };
  },

  /* [finnes] GET /api/chat-sessions?surface=lorecore */
  async sessions() {
    if (SOURCE === 'live') return unwrap(await api('/api/chat-sessions?surface=lorecore&limit=30'));
    return wait([]);
  },
  async sessionMessages(pid) {
    if (SOURCE === 'live') return (await api(`/api/chat-sessions/${pid}`)).messages || [];
    return wait([]);
  },

  /* [finnes] POST /api/lorecore/extract — men skriver direkte.
     Må ta dry_run:true og returnere kandidater uten skriv. */
  async extractDryRun(sessionPid) {
    if (SOURCE === 'live') return api('/api/lorecore/extract', { method: 'POST', body: { session_public_id: sessionPid, dry_run: true } });
    return wait([]);
  },

  /* MANGLER: POST /api/lorecore/persist — generisk persist-agent.
     persist_agent.py finnes allerede i scripts/, mangler rute. */
  async persistCandidates(sessionPid, ids) {
    if (SOURCE === 'live') return api('/api/lorecore/persist', { method: 'POST', body: { session_public_id: sessionPid, candidate_ids: ids } });
    return wait({ written: ids.length, verified: ids.length, rejected: [] }, 500);
  },

  /* [finnes] POST /api/lorecore/books/{pid}/run-stage
     Skop-treet treffer denne med ulik stage — ikke et nytt /runs-endepunkt. */
  async startRun({ stage, book_public_id, scope_kind, scope_pid }) {
    if (SOURCE === 'live') return api(`/api/lorecore/books/${book_public_id}/run-stage`,
      { method: 'POST', body: { stage, scope_kind, scope_pid } });
    return wait({ public_id: 'PR-' + Date.now().toString(36).toUpperCase(), status: 'queued' }, 300);
  },

  /* [finnes] GET /api/pipelines/runs/active */
  async activeRuns() {
    if (SOURCE === 'live') return unwrap(await api('/api/pipelines/runs/active'));
    return wait([]);
  },

  /* [finnes] POST /api/pipelines/runs/{job_id}/regenerate-chapter/{chapter_n} */
  async regenerateChapter(jobId, chapterN) {
    if (SOURCE === 'live') return api(`/api/pipelines/runs/${jobId}/regenerate-chapter/${chapterN}`, { method: 'POST' });
    return wait({ ok: true });
  },

  aspects: () => clone(F.ASPECTS),

  /* Modulkjeden. Stage-navnene må bekreftes mot run-stage sin enum. */
  moduleTree: () => ([
    { key: 'research',  label: 'Research',             depth: 1 },
    { key: 'preplan',   label: 'Verden og karakterer', depth: 1 },
    { key: 'structure', label: 'Plot og tidslinje',    depth: 1 },
    { key: 'briefs',    label: 'Kapittel-briefs',      depth: 1 },
    { key: 'chapters',  label: 'Kapittel-modulen',     depth: 1 },
    { key: 'audit',     label: 'Språk-audit',          depth: 1 },
    { key: 'publish',   label: 'Utgivelse',            depth: 1 },
  ]),

  deliberationModes: () => ([
    { key: 'single',    label: 'Én modell', hint: 'ingen kryssjekk — kun mekaniske oppgaver' },
    { key: 'committee', label: 'Komité',    hint: '3 familier som leser hverandre + synthesizer' },
    { key: 'deep',      label: 'Dyp',       hint: '5 familier — for irreversible valg' },
  ]),
};
