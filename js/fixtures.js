/* LoreCore — fixtures.
   ══════════════════════════════════════════════════════════════════
   VIKTIG: dette er ikke mockup-data. Hver eksport har EKSAKT formen
   det tilsvarende endepunktet skal returnere. Når backend bygges,
   er dette kontrakten den skal oppfylle — og store.js bytter kilde
   uten at én komponent røres.

   Endepunkt-kartet står som kommentar over hver eksport.
   ══════════════════════════════════════════════════════════════════ */

const NOW = new Date();
const iso = d => new Date(d).toISOString();
const daysAgo = n => iso(NOW.getTime() - n * 864e5);
const minsAgo = n => iso(NOW.getTime() - n * 6e4);

/* ─────────────────────────────────────────────────────────
   GET /api/lorecore/overview?library_public_id=
   Erstatter dagens overview som laster alt. Nå: kun tellinger
   og gruppering. Detaljer hentes on demand.
   ───────────────────────────────────────────────────────── */
export const overview = {
  selected_library: 'LIB-GALDURDAL',
  libraries: [
    { public_id: 'LIB-GALDURDAL', name: 'Galdurdal', universe_id: 'UNI-GALDURDAL',
      status: 'active', engagement_pid: null },
  ],
  // book_group_id + version_label — skjema-delta 2.1
  book_groups: [
    {
      book_group_id: 'BGR-GALDURDAL-1',
      title: 'Galdurdal Book 1',
      library_public_id: 'LIB-GALDURDAL',
      author_public_id: 'AUT-GALDURDAL',
      versions: [
        { public_id: 'LBK-GALDV31A', version_label: 'V31A', status: 'archived', chapter_count: 25, word_count: 104200, updated_at: daysAgo(64) },
        { public_id: 'LBK-GALDV31B', version_label: 'V31B', status: 'archived', chapter_count: 25, word_count: 111800, updated_at: daysAgo(41) },
        { public_id: 'LBK-GALDV31C', version_label: 'V31C', status: 'archived', chapter_count: 25, word_count: 114600, updated_at: daysAgo(22) },
        { public_id: 'LBK-GALDV31D', version_label: 'V31D', status: 'written',  chapter_count: 25, word_count: 116400, updated_at: daysAgo(2) },
      ],
    },
  ],
  canon: {
    universe_id: 'UNI-GALDURDAL',
    worlds: 1, characters: 7, locations: 20, factions: 3, routes: 20,
  },
  counts: { sources: 6, authors: 1, open_findings: 14, closed_findings: 22 },
};

/* ─────────────────────────────────────────────────────────
   GET /api/lorecore/chapters?book_public_id=
   Lettvekt-liste. `flags` driver badge-regelen: badge kun ved avvik.
   ───────────────────────────────────────────────────────── */
const chapterTitles = [
  'The Nook Above the World', 'The Accounting of Salt', 'The Gangplank',
  'Salt and Silver', 'The Long Water', 'What the Ledger Kept',
  'Nightfall at Ravensfjord', 'The Weight of Rope', 'A Debt in Amber',
  'The Cold Room', 'Where the Knarrs Wait', 'The Second Ledger',
  'The Breaking of Ice', 'The Mapped Circuit', 'Dorestad',
  'The Bargain Unspoken', 'Wolf-Skin', 'The Girl at the Waterline',
  'What Björn Counted', 'The Turning Tide', 'Blood on the Strake',
  'The Last Accounting', 'Ulfr Alone', 'The Pocket Beneath', 'Homeward, Unfinished',
];

export const chaptersByBook = {
  'LBK-GALDV31D': chapterTitles.map((title, i) => {
    const n = i + 1;
    const flags = [];
    if (n === 1) flags.push({ kind: 'missing_brief', label: 'brief', tone: 'warn' });
    if (n === 13) flags.push({ kind: 'voice_override', label: 'stemme', tone: 'ovr' });
    return {
      public_id: `LCH-GALDV31D-${String(n).padStart(2, '0')}`,
      book_public_id: 'LBK-GALDV31D',
      order_index: n,
      title,
      status: n === 1 ? 'written' : 'written',
      pov: [13, 19, 23].includes(n) ? 'Björn' : n === 18 ? 'The Girl' : 'Wren',
      scene_count: n === 13 ? 6 : 5 + (n % 3),
      word_count: 4200 + (n * 37) % 900,
      has_brief: n !== 1,
      updated_at: daysAgo(2 + (n % 5)),
      flags,
    };
  }),
};

/* ─────────────────────────────────────────────────────────
   GET /api/lorecore/chapters/{pid}
   Brief parses server-side til scenes[]. Frontend får struktur,
   ikke JSON-streng — det er en endring fra dagens felt.
   ───────────────────────────────────────────────────────── */
export const chapterDetail = {
  'LCH-GALDV31D-13': {
    public_id: 'LCH-GALDV31D-13', book_public_id: 'LBK-GALDV31D',
    order_index: 13, title: 'The Breaking of Ice', status: 'written',
    pov: 'Björn', word_count: 4680, updated_at: daysAgo(2),
    pipeline_run_id: 'PLR-V31D-1140',
    written_by: ['Kimi', 'MiniMax M3', 'gpt-oss'], synthesized_by: 'GLM',
    canon_check: 'passed',
    voice: {
      author_public_id: 'AUT-GALDURDAL',
      inherited: true,
      override: {
        public_id: 'LVO-0004', target_kind: 'chapter', target_pid: 'LCH-GALDV31D-13',
        set_at: daysAgo(9), set_by: 'kris',
        reason: 'Kapittelet leste flatt — vendepunktet manglet mytisk vekt.',
        rule_deltas: [
          { rule_key: 'R2', direction: 'down', note: 'kun ved Wren' },
          { rule_key: 'R3', direction: 'up',   note: 'isbruddet skal bæres videre' },
        ],
      },
    },
    scenes: [
      { public_id: 'LSC-GALDV31D-13-D', letter: 'D', order_index: 4,
        title: 'Isen brister', pov: 'Björn', location: 'Ravensfjord',
        target_words: 780, word_count: 812,
        key_beats: [
          'Isen brister. Björn registrerer det som en dato, ikke et varsel.',
          'Wren ser det samme og forstår noe annet.',
        ],
        opening_state: 'Før daggry, fjorden lukket.',
        ending_state: 'Kanalen åpen. Ni dager til knarrene kan gå.',
        voice_notes: 'Ingen primitivt lag. Björn teller.',
        content:
`Isen ga etter en time før daggry, med en lyd som ikke lignet noe annet i året.

Björn noterte den. Sjette dag etter fullmåne. Knarrene kunne gå om ni dager, ikke før.`,
      },
    ],
  },
  'LCH-GALDV31D-01': {
    public_id: 'LCH-GALDV31D-01', book_public_id: 'LBK-GALDV31D',
    order_index: 1, title: 'The Nook Above the World', status: 'written',
    pov: 'Wren', word_count: 4310, updated_at: daysAgo(2),
    pipeline_run_id: null,
    written_by: [], synthesized_by: null, canon_check: 'blocked',
    voice: { author_public_id: 'AUT-GALDURDAL', inherited: true, override: null },
    brief_missing: true,
    brief_missing_note:
      'Kjent commit-bug: brief ble generert men skrevet til feil substrat-rad. Kan ikke språkverifiseres uten POV-kontrakt.',
    scenes: [
      { public_id: 'LSC-GALDV31D-01-A', letter: 'A', order_index: 1,
        title: null, pov: null, location: null,
        target_words: null, word_count: 890,
        key_beats: [], opening_state: null, ending_state: null, voice_notes: null,
        content:
`Varmen mot ryggen der røykrøret møter taktekket, lukten av gammelt sot og tørket salt, våknet uten å røre seg.

Han pustet inn. Lufta var tykk, hengende i kroken som vann i en tønne.`,
      },
    ],
  },
};

/* ─────────────────────────────────────────────────────────
   GET /api/lorecore/authors        → liste
   GET /api/lorecore/authors/{pid}  → med rules[] og sources[]
   Ny tabell: lore_authors + lore_author_rules + lore_author_sources
   ───────────────────────────────────────────────────────── */
export const authors = [
  {
    public_id: 'AUT-GALDURDAL', name: 'Galdurdal-stemmen', scope: 'global',
    ownership: 'own',
    description: 'Cornwell-ryggrad med Rothfuss-interioritet sparsomt og Wilde-legendeløft ved vendepunkt.',
    source_count: 3, used_by_books: 1, override_count: 1, active_rules: 7,
    sources: [
      { public_id: 'LSR-CORNWELL', name: 'Bernard Cornwell', aspects: ['progresjon', 'setningsrytme', 'faktahåndtering'], role: 'ryggrad' },
      { public_id: 'LSR-WILDE',    name: 'James Wilde',      aspects: ['legendeoppbygging'], role: 'løft' },
      { public_id: 'LSR-ROTHFUSS', name: 'Patrick Rothfuss', aspects: ['interioritet', 'følelsesskildring'], role: 'interioritet' },
    ],
    rules: [
      { rule_key: 'R1', condition: 'always', reads_from_canon: null, threshold: null,
        rule_text: 'Cornwell-ryggrad: kort setningsrytme, hendelse før refleksjon, fakta uten utsmykning.' },
      { rule_key: 'R2', condition: 'when', reads_from_canon: null, threshold: null,
        rule_text: 'Rothfuss-interioritet i scener med menneskelig kontakt — sparsomt, aldri to ganger i samme scene.' },
      { rule_key: 'R3', condition: 'when', reads_from_canon: null, threshold: null,
        rule_text: 'Wilde-legendeløft når en hendelse skal bæres videre som fortelling.' },
      { rule_key: 'R7', condition: 'never', reads_from_canon: 'lore_characters.cold', threshold: null,
        rule_text: 'Primitivt lag i POV til karakter merket cold=true i kanon. Ingen førbevisste kroppslige reaksjoner — pustestopp, muskelspenning, grep som strammer — før kognitiv registrering.' },
      { rule_key: 'R9', condition: 'always', reads_from_canon: null, threshold: { max_per_book: 40, exempt: 'proper_nouns' },
        rule_text: 'Ingen ordmonopol: intet ord over 40 forekomster per bok uten at det er egennavn.' },
    ],
    compliance: [
      { rule_key: 'R1', label: 'R1 ryggrad',        state: 'ok',  value: 'innenfor' },
      { rule_key: 'R7', label: 'R7 primitivt lag',  state: 'bad', value: '2 brudd' },
      { rule_key: 'R9', label: 'R9 ordmonopol',     state: 'bad', value: 'Björn 118x' },
    ],
  },
];

/* GET /api/lorecore/voice-overrides?author_public_id= */
export const voiceOverrides = [
  { public_id: 'LVO-0004', author_public_id: 'AUT-GALDURDAL',
    target_kind: 'chapter', target_pid: 'LCH-GALDV31D-13',
    target_label: 'The Breaking of Ice', target_number: 13,
    summary: 'Rothfuss ned · Wilde opp', set_at: daysAgo(9) },
];

/* ─────────────────────────────────────────────────────────
   GET /api/lorecore/canon?universe_id=
   Kanon er per univers og endres ikke ved versjonsbytte.
   ───────────────────────────────────────────────────────── */
export const canon = {
  universe_id: 'UNI-GALDURDAL',
  worlds: [
    { public_id: 'LWO-GALDURDAL', name: 'Galdurdal', kind: 'region',
      note: 'skjult lag: lommedimensjon', hidden: true },
  ],
  characters: [
    { public_id: 'LCR-BJORN',  name: 'Björn',              cold: true,  note: 'cold=true' },
    { public_id: 'LCR-ULFR',   name: 'Ulfr',               cold: true,  note: 'cold=true' },
    { public_id: 'LCR-DYRI',   name: 'Dýri',               cold: true,  note: 'cold=true' },
    { public_id: 'LCR-WREN',   name: 'Wren',               cold: false, note: 'POV-bærer' },
    { public_id: 'LCR-ALDRIC', name: 'Aldric',             cold: false, note: null },
    { public_id: 'LCR-GODERT', name: 'Godert of Dorestad', cold: false, note: null },
    { public_id: 'LCR-GIRL',   name: 'The Girl',           cold: false, note: null },
  ],
  read_by: [
    { label: 'Forfatterregel R7', value: 'cold=true', state: '' },
    { label: 'Kanon-verifier',    value: 'aktiv',     state: 'ok' },
  ],
};

/* ─────────────────────────────────────────────────────────
   GET /api/lorecore/sources
   Ny tabell: lore_sources + lore_source_aspects
   ───────────────────────────────────────────────────────── */
export const ASPECT_KINDS = [
  { key: 'rytme',      label: 'Setningsrytme',      short: 'rytme' },
  { key: 'progresjon', label: 'Progresjon',         short: 'progr' },
  { key: 'fakta',      label: 'Faktahåndtering',    short: 'fakta' },
  { key: 'kapittel',   label: 'Kapittelarkitektur', short: 'kap' },
  { key: 'dialog',     label: 'Dialogmønster',      short: 'dialog' },
  { key: 'overgang',   label: 'Scene-overganger',   short: 'overg' },
];

const ASPECT_DESC = {
  kapittel: 'Hvordan kapitler settes sammen — lengde, antall scener, hvor vendepunkt plasseres.',
  dialog:   'Replikklengde, hvor mye som sies mot antydes, bruk av dialektmarkører.',
  overgang: 'Hvordan scener bindes sammen — kutt, brolegging, tidshopp.',
};

export const sources = [
  {
    public_id: 'LSR-CORNWELL', name: 'Bernard Cornwell', ownership: 'own', client_ref: null,
    used_in: [{ public_id: 'AUT-GALDURDAL', name: 'Galdurdal-stemmen', role: 'Ryggrad — R1 setningsrytme, progresjon, faktahåndtering.' }],
    works: [
      { public_id: 'LSW-TLK', title: 'The Last Kingdom',      word_count: 118400, mined: ['rytme', 'progresjon', 'fakta'] },
      { public_id: 'LSW-TPH', title: 'The Pale Horseman',     word_count: 124700, mined: ['rytme', 'progresjon', 'fakta'] },
      { public_id: 'LSW-TLN', title: 'The Lords of the North', word_count: 109200, mined: ['rytme', 'progresjon', 'fakta'] },
    ],
    aspects: [
      { aspect_kind: 'rytme', mined_at: daysAgo(131), status: 'mined',
        summary: 'Snittlengde {11.0 ord}, lav varians. Kort og hendelsesdrevet. Em-dash {1.6 per 1000 ord}.' },
      { aspect_kind: 'progresjon', mined_at: daysAgo(131), status: 'mined',
        summary: 'Hendelse før refleksjon, aldri omvendt. Kapitler lukker på handling, ikke på innsikt.' },
      { aspect_kind: 'fakta', mined_at: daysAgo(131), status: 'mined',
        summary: 'Historiske detaljer oppgis nøytralt, uten forklarende innskudd til leseren.' },
      { aspect_kind: 'kapittel', mined_at: null, status: 'not_mined', summary: ASPECT_DESC.kapittel },
      { aspect_kind: 'dialog',   mined_at: null, status: 'not_mined', summary: ASPECT_DESC.dialog },
      { aspect_kind: 'overgang', mined_at: null, status: 'not_mined', summary: ASPECT_DESC.overgang },
    ],
    runs: [
      { public_id: 'PLR-MINE-0031', label: 'Miner kapittelarkitektur · 3 bøker', status: 'running',
        progress_label: 'bok 2 av 3', started_at: minsAgo(14) },
      { public_id: 'PLR-MINE-0012', label: 'Miner rytme, progresjon, fakta', status: 'done',
        progress_label: null, started_at: daysAgo(131) },
    ],
  },
  {
    public_id: 'LSR-ROTHFUSS', name: 'Patrick Rothfuss', ownership: 'own', client_ref: null,
    used_in: [{ public_id: 'AUT-GALDURDAL', name: 'Galdurdal-stemmen', role: 'Interioritet — R2, sparsomt.' }],
    works: [
      { public_id: 'LSW-NOTW', title: 'The Name of the Wind',  word_count: 259000, mined: ['interior'], partial: ['plot'] },
      { public_id: 'LSW-WMF',  title: "The Wise Man's Fear",   word_count: 395000, mined: ['interior'] },
    ],
    aspects: [
      { aspect_kind: 'rytme', mined_at: daysAgo(120), status: 'mined',
        summary: 'Lang varians. Snittlengde {17.4 ord}, med bevisste korte innskudd som brudd.' },
      { aspect_kind: 'progresjon', mined_at: null, status: 'not_mined', summary: 'Ikke trukket ut fra dette materialet.' },
      { aspect_kind: 'fakta', mined_at: null, status: 'not_mined', summary: 'Ikke trukket ut fra dette materialet.' },
      { aspect_kind: 'kapittel', mined_at: null, status: 'not_mined', summary: ASPECT_DESC.kapittel },
      { aspect_kind: 'dialog',   mined_at: null, status: 'not_mined', summary: ASPECT_DESC.dialog },
      { aspect_kind: 'overgang', mined_at: null, status: 'not_mined', summary: ASPECT_DESC.overgang },
    ],
    runs: [],
  },
  {
    public_id: 'LSR-WILDE', name: 'James Wilde', ownership: 'own', client_ref: null,
    used_in: [{ public_id: 'AUT-GALDURDAL', name: 'Galdurdal-stemmen', role: 'Legendeløft — R3.' }],
    works: [
      { public_id: 'LSW-HERE', title: 'Hereward', word_count: 121000, mined: ['legende'] },
    ],
    aspects: [
      { aspect_kind: 'rytme', mined_at: null, status: 'not_mined', summary: 'Ikke trukket ut fra dette materialet.' },
      { aspect_kind: 'progresjon', mined_at: null, status: 'not_mined', summary: 'Ikke trukket ut fra dette materialet.' },
      { aspect_kind: 'fakta', mined_at: null, status: 'not_mined', summary: 'Ikke trukket ut fra dette materialet.' },
      { aspect_kind: 'kapittel', mined_at: null, status: 'not_mined', summary: ASPECT_DESC.kapittel },
      { aspect_kind: 'dialog',   mined_at: null, status: 'not_mined', summary: ASPECT_DESC.dialog },
      { aspect_kind: 'overgang', mined_at: null, status: 'not_mined', summary: ASPECT_DESC.overgang },
    ],
    runs: [],
  },
];

/* ─────────────────────────────────────────────────────────
   GET /api/lorecore/findings?book_public_id=&status=
   Ny tabell: lore_findings. Grupperes etter HVA de bryter.
   ───────────────────────────────────────────────────────── */
export const findings = [
  {
    public_id: 'LAF-0101', book_public_id: 'LBK-GALDV31D',
    breaks: 'author', rule_key: 'R7', severity: 'blocker', status: 'open',
    title: 'Primitivt lag i kald POV',
    scope_label: 'kap 13 · 2 treff',
    summary: '2 treff i kapittel 13. Regelen leser <code>cold=true</code> fra kanon og gjelder derfor Björn, Ulfr og Dýri.',
    measured_against: {
      rule_key: 'R7', author_name: 'Galdurdal-stemmen', condition: 'never',
      inherited_note: 'arvet · ikke overstyrt i kap 13',
      rule_text: 'Primitivt lag i POV til karakter merket <code>cold=true</code>. Ingen førbevisste kroppslige reaksjoner — pustestopp, muskelspenning, grep som strammer — før kognitiv registrering.',
    },
    hits: [
      { address: { chapter: 13, scene: 4, sentence: 12 },
        target_pid: 'LCH-GALDV31D-13',
        text_before: 'Isen ga etter en time før daggry. ',
        text_mark: 'Björn kjente pusten stoppe et øyeblikk før han forsto hva lyden var',
        text_after: ', og først da noterte han datoen.',
        why: 'Pustestopp er en førbevisst kroppslig reaksjon, plassert før kognitiv registrering. R7 forbyr det i Björns POV.' },
      { address: { chapter: 13, scene: 6, sentence: 4 },
        target_pid: 'LCH-GALDV31D-13',
        text_before: 'Han så skipet komme inn mot kaia. ',
        text_mark: 'Grepet om rekka strammet seg av seg selv.',
        text_after: '',
        why: '«Av seg selv» markerer eksplisitt en ufrivillig kroppslig reaksjon. R7 forbyr det i Björns POV.' },
    ],
    fix_scopes: [
      { key: 'scenes',  label: 'Kun scene 4 og 6',            est_minutes: 2 },
      { key: 'chapter', label: 'Hele kapittel 13',             est_minutes: 6 },
      { key: 'all',     label: 'Alle kapitler med R7-treff',   est_minutes: 24 },
    ],
  },
  { public_id: 'LAF-0102', book_public_id: 'LBK-GALDV31D', breaks: 'author', rule_key: 'R9',
    severity: 'major', status: 'open', title: 'Ordmonopol «kald»', scope_label: 'kap 13 · 31 forekomster',
    summary: '31 forekomster i kapittelet. R9-terskel er 12 per kapittel.', hits: [], fix_scopes: [] },
  { public_id: 'LAF-0103', book_public_id: 'LBK-GALDV31D', breaks: 'author', rule_key: 'R3',
    severity: 'major', status: 'open', title: 'Legendeløft uteblir', scope_label: 'kap 13 · scene 4',
    summary: 'R3 er betinget på hendelse som skal bæres videre. Isbruddet er ikke merket sånn.', hits: [], fix_scopes: [] },
  { public_id: 'LAF-0104', book_public_id: 'LBK-GALDV31D', breaks: 'author', rule_key: 'R1',
    severity: 'minor', status: 'open', title: 'Em-dash over kildesnitt', scope_label: 'kap 8, 13, 19',
    summary: '4.1 per 1000 ord mot kildesnitt 1.8.', hits: [], fix_scopes: [] },
  { public_id: 'LAF-0201', book_public_id: 'LBK-GALDV31D', breaks: 'canon', rule_key: null,
    severity: 'blocker', status: 'open', title: 'Portplassering motsier kanon', scope_label: 'kap 1 · scene 2',
    summary: 'Scenen plasserer porten nord for elveløpet. Kanon sier sør.', hits: [], fix_scopes: [] },
  { public_id: 'LAF-0202', book_public_id: 'LBK-GALDV31D', breaks: 'canon', rule_key: null,
    severity: 'major', status: 'open', title: 'Navneform: Bjorn / Björn', scope_label: '14 kapitler',
    summary: 'To former av samme egennavn på tvers av manuskriptet. Kanonisk form er Björn.', hits: [], fix_scopes: [] },
  { public_id: 'LAF-0301', book_public_id: 'LBK-GALDV31D', breaks: 'unassessable', rule_key: null,
    severity: 'blocker', status: 'open', title: 'Mangler brief — ingen POV', scope_label: 'kap 1',
    summary: 'Uten POV-kontrakt kan ikke språkregler evalueres for dette kapittelet.', hits: [], fix_scopes: [] },
];

/* GET /api/lorecore/qc/metrics?book_public_id=  — mekaniske, kjører kontinuerlig */
export const metrics = {
  book_public_id: 'LBK-GALDV31D',
  last_run_at: minsAgo(4),
  items: [
    { key: 'monopoly',  label: 'Ordmonopol',           value: '«kald» 31x', state: 'bad', foot: 'terskel 12' },
    { key: 'emdash',    label: 'Em-dash / 1000 ord',   value: '4.1',        state: 'bad', foot: 'kilde 1.8' },
    { key: 'sentlen',   label: 'Snitt setningslengde', value: '11.4',       state: 'ok',  foot: 'Cornwell 11.0' },
    { key: 'nameform',  label: 'Navneform-konsistens', value: '2 former',   state: 'bad', foot: 'Björn · Bjorn' },
    { key: 'tense',     label: 'Tempus-drift',         value: '0',          state: 'ok',  foot: 'segmenter' },
    { key: 'triadic',   label: 'Triadiske konstr.',    value: '7',          state: '',    foot: 'kilde 4–9' },
  ],
};

/* GET /api/lorecore/qc/passes?book_public_id=  — vurderingspass, 3-way, på forespørsel */
export const passes = [
  { key: 'canon',    label: 'Kanonbrudd',                          state: 'ok',    detail: 'kjørt 27/05' },
  { key: 'voice',    label: 'Stemme-kontaminering og karakter-bleed', state: 'stale', detail: 'utdatert — kap 13 skrevet om' },
  { key: 'regi',     label: 'Regi-lekkasje',                       state: '',      detail: 'aldri kjørt' },
  { key: 'lock',     label: 'Lock-phrase meaning collapse',        state: '',      detail: 'aldri kjørt' },
];

/* GET /api/lorecore/books/{pid}/health */
export const bookHealth = {
  book_public_id: 'LBK-GALDV31D',
  blockers: 3, canon_drift: 1, chapters_without_brief: 1, publishable: false,
};

/* ─────────────────────────────────────────────────────────
   GET /api/chat-sessions?surface=lorecore
   GET /api/chat-sessions/{id}  → .messages[]
   Finnes allerede. Utvidet med scope + deliberation_mode.
   ───────────────────────────────────────────────────────── */
export const sessions = [
  { public_id: 'CHS-0801', title: 'Stemme for kapittel 13', updated_at: minsAgo(240),
    scope_kind: 'chapter', scope_pid: 'LCH-GALDV31D-13', scope_label: 'KAP 13 · V31D',
    deliberation_mode: 'committee', persisted: true },
  { public_id: 'CHS-0800', title: 'Wren — hva vet hun egentlig', updated_at: daysAgo(1),
    scope_kind: 'book', scope_pid: 'LBK-GALDV31D', scope_label: 'V31D',
    deliberation_mode: 'committee', persisted: false },
  { public_id: 'CHS-0788', title: 'Galdurdal Chronicles: The Wolf-Skin', updated_at: daysAgo(123),
    scope_kind: 'library', scope_pid: 'LIB-GALDURDAL', scope_label: 'GALDURDAL',
    deliberation_mode: 'deep', persisted: false },
  { public_id: 'CHS-0771', title: 'Barnebok-stemme, første forsøk', updated_at: daysAgo(126),
    scope_kind: 'none', scope_pid: null, scope_label: 'uten bok-kontekst',
    deliberation_mode: 'single', persisted: false },
  { public_id: 'CHS-0002', title: 'Fri samtale', updated_at: daysAgo(140),
    scope_kind: 'none', scope_pid: null, scope_label: 'uten bok-kontekst',
    deliberation_mode: 'single', persisted: false },
];

export const sessionMessages = {
  'CHS-0801': [
    { kind: 'message', role: 'user',
      content: 'Kapittel 13 leser flatt. Isbruddet er vendepunktet i akten, men det står der som en værmelding. Wilde-laget mangler.' },
    { kind: 'message', role: 'assistant',
      content: 'Enig — R3 er betinget på «hendelse som skal bæres videre som fortelling», og isbruddet er ikke merket sånn. Björn registrerer det som en dato, som er riktig for ham, men ingen andre løfter det.\n\nJeg foreslår: skru ned R2 til kun Wren-scener, og opp R3 for kapittelet. Det lar isbruddet få mytisk vekt uten å varme opp Björn.' },
    { kind: 'run', public_id: 'PLR-V31D-1139', label: 'stemme-overstyring · kapittel 13',
      status: 'done', status_label: 'lagret · 8 sek',
      body: 'Overstyring skrevet til substrat. Arver Galdurdal-stemmen, avviker på to regler.',
      chips: ['R2 ned — kun Wren', 'R3 opp — legendeløft'], voters: [],
      note: 'Grunn lagret: kapittelet leste flatt, vendepunktet manglet mytisk vekt.',
      action: { label: 'Se i Library', target: 'library:LCH-GALDV31D-13' } },
    { kind: 'message', role: 'assistant',
      content: 'Vil du skrive kapittelet på nytt med den nye stemmen? Det tar rundt 6 minutter for 6 scener.' },
    { kind: 'message', role: 'user', content: 'ja kjør' },
    { kind: 'run', public_id: 'PLR-V31D-1140', label: 'kapittel-modulen · kap 13',
      status: 'running', status_label: 'kjører · scene 4 av 6',
      body: 'Skriver mot ny stemme-overstyring. Kanon uendret.',
      chips: [], voters: ['Kimi', 'MiniMax M3', 'gpt-oss', '→ GLM synth'],
      note: 'Skriver til substrat etter hver scene. Du kan fortsette å snakke.',
      action: { label: 'Avbryt', target: 'cancel:PLR-V31D-1140' } },
  ],
};

/* ─────────────────────────────────────────────────────────
   POST /api/lorecore/extract  {dry_run:true}  → kandidater, INGEN skriv
   Gate-modellen. Operatør huker av, deretter persist-agent.
   ───────────────────────────────────────────────────────── */
export const extractCandidates = {
  'CHS-0801': [
    { id: 'c1', kind: 'fact',       target: 'canon',  checked: true,
      label: 'Wren vet om isbruddet før Björn',
      quote: 'Wren ser det samme og forstår noe annet.' },
    { id: 'c2', kind: 'decision',   target: 'book',   checked: true,
      label: 'Isbruddet merkes som legende-hendelse',
      quote: 'R3 er betinget på hendelse som skal bæres videre.' },
    { id: 'c3', kind: 'fact',       target: 'canon',  checked: false,
      label: 'Ny lokasjon: iskanten ved Ravensfjord',
      quote: 'Isen ga etter en time før daggry.' },
  ],
};

/* ─────────────────────────────────────────────────────────
   GET /api/lorecore/modules?book_public_id=   — scope-treet
   POST /api/lorecore/runs {module_key, scope_kind, scope_pid}
   ───────────────────────────────────────────────────────── */
export const moduleTree = {
  book_public_id: 'LBK-GALDV31D',
  root: { key: 'full', label: 'Full bok-pipeline', state: '', detail: '8 moduler', depth: 0 },
  nodes: [
    { key: 'research',  label: 'Research',             state: 'ok',  detail: 'låst',    depth: 1 },
    { key: 'preplan',   label: 'Verden og karakterer', state: 'ok',  detail: 'låst',    depth: 1 },
    { key: 'plot',      label: 'Plot og tidslinje',    state: 'ok',  detail: '4 akter', depth: 1 },
    { key: 'briefs',    label: 'Kapittel-briefs',      state: 'gap', detail: '1 mangler', depth: 1 },
    { key: 'chapters',  label: 'Kapittel-modulen',     state: 'now', detail: 'kjører',  depth: 1 },
    { key: 'ch13',      label: 'Kapittel 13',          state: 'now', detail: '4/6',     depth: 2, scope_pid: 'LCH-GALDV31D-13' },
    { key: 'ch14',      label: 'Kapittel 14',          state: '',    detail: 'kø',      depth: 2, scope_pid: 'LCH-GALDV31D-14' },
    { key: 'audit',     label: 'Språk-audit',          state: '',    detail: 'venter',  depth: 1 },
    { key: 'publish',   label: 'Utgivelse',            state: '',    detail: 'venter',  depth: 1 },
  ],
};

/* GET /api/lorecore/runs?status=active — driver den vedvarende linja */
export const activeRuns = [
  { public_id: 'PLR-V31D-1141', label: 'kapittel-modulen · kap 14–25',
    where: 'skriver kapittel 18 · scene 3 av 6', percent: 74, eta_minutes: 52, status: 'running' },
];

/* Deliberasjonsmodus — navn og forklaring hører sammen, aldri bare navnet */
export const deliberationModes = [
  { key: 'single',    label: 'Én modell', hint: 'raskt, ingen kryssjekk — kun for mekaniske oppgaver' },
  { key: 'committee', label: 'Komité',    hint: '3 familier som leser hverandre + synthesizer' },
  { key: 'deep',      label: 'Dyp',       hint: '5 familier — for irreversible valg' },
];
