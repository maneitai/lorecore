import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('./index.html', 'utf8');
const dom = new JSDOM(html, { url: 'https://lore.maneit.net/', runScripts: 'outside-only', pretendToBeVisual: true });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.location = dom.window.location;
global.fetch = async () => { throw new Error('fetch skal ikke kalles i fixture-modus'); };
global.structuredClone = v => JSON.parse(JSON.stringify(v));
global.setInterval = () => 0;

const errors = [];
dom.window.addEventListener('error', e => errors.push(e.message));

const { app } = await import('./js/app.js');
document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
const settle = (ms = 400) => new Promise(r => setTimeout(r, ms));
await settle();

const size = id => document.getElementById(id).innerHTML.length;
const report = [];

async function check(label, fn) {
  try { await fn(); report.push(`  ok   ${label}`); }
  catch (e) { report.push(`  FAIL ${label} — ${e.message}`); errors.push(label + ': ' + e.message); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function surface(mode, sel) {
  await app.go(mode, sel); await settle();
  assert(size('rail') > 200, 'rail tom');
  assert(size('main') > 200, 'main tom');
  assert(document.getElementById('shell').dataset.mode === mode, 'data-mode ikke satt');
}

function click(sel) {
  const el = document.querySelector(sel);
  if (!el) throw new Error('fant ikke ' + sel);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

console.log('\n── LoreCore smoke ──\n');

await check('Library rendrer', () => surface('library'));
await check('Library: senteret er aldri tomt ved oppstart', () => {
  assert(document.querySelector('#main .mh'), 'ingen header i senteret');
});
await check('Library: badge kun ved avvik', () => {
  const items = [...document.querySelectorAll('#rail .it.sub')];
  const tagged = items.filter(i => i.querySelector('.tag'));
  assert(items.length > 3, 'ingen kapitler i rail');
  assert(tagged.length <= 2, 'for mange badges — regelen er kun ved avvik');
});
await check('Library: velg kapittel med manglende brief', async () => {
  click('[data-pick="chapter"][data-pid="LCH-GALDV31D-01"]'); await settle();
  assert(document.querySelector('#main .badge.warn'), 'mangler warn-badge');
  assert(document.querySelector('#main .empty .btn'), 'fravær er ikke handlingsdyktig');
});
await check('Library: velg kapittel med stemme-overstyring', async () => {
  click('[data-pick="chapter"][data-pid="LCH-GALDV31D-13"]'); await settle();
  assert(document.querySelector('#main .badge.ovr'), 'mangler ovr-badge');
  assert(document.querySelector('#main .diffline'), 'mangler avviksliste');
  assert(document.querySelector('#ctx .find'), 'mangler funn i kontekst');
});
await check('Library: versjonsbytte laster kapitler på nytt', async () => {
  click('[data-version="LBK-GALDV31B"]'); await settle();
  assert(app.state.bookPid === 'LBK-GALDV31B', 'bookPid ikke byttet');
  click('[data-version="LBK-GALDV31D"]'); await settle();
});
await check('Library: kanon-skop', async () => {
  click('[data-pick="canon"]'); await settle();
  assert(document.getElementById('main').innerHTML.includes('cold=true'), 'kanon-flagg mangler');
});
await check('Library: kilde-skop', async () => {
  click('[data-pick="source"]'); await settle();
  assert(document.querySelector('#main .voicebox'), 'uttrukne trekk mangler');
});
await check('Library: utvid kapittelliste', async () => {
  click('[data-pick="author"]'); await settle();
  click("[data-expand-chapters]"); await settle();
  assert(document.querySelectorAll('#rail .it.sub').length > 20, 'kapitler ikke utvidet');
});

await check('Author rendrer', () => surface('author'));
await check('Author: samtalen har kjøringer inline', () => {
  assert(document.querySelectorAll('#main .run').length >= 2, 'mangler inline runs');
  assert(document.querySelector('#main .voters'), 'mangler voter-visning');
});
await check('Author: skop-tre kjørbart på alle nivåer', () => {
  assert(document.querySelectorAll('#ctx .tn').length >= 9, 'skop-tre for grunt');
});
await check('Author: ekstraksjon er gate, ikke automatikk', async () => {
  assert(document.querySelectorAll('#ctx [data-cand]').length === 3, 'mangler kandidater');
  click('[data-persist]'); await settle(900);
  assert(document.getElementById('ctx').innerHTML.includes('Bekreftet'), 'gate nådde ikke verifisert');
});
await check('Author: deliberasjonsmodus bytter forklaring', async () => {
  click('[data-mode-pick="deep"]'); await settle();
  assert(document.querySelector('#main .dhint').textContent.includes('5 familier'), 'hint fulgte ikke modus');
});
await check('Author: vedvarende kjøringslinje synlig', () => {
  assert(document.getElementById('longrun').hidden === false, 'longrun skjult');
});

await check('QC rendrer', () => surface('qc'));
await check('QC: funn gruppert etter hva de bryter', () => {
  const grps = [...document.querySelectorAll('#rail .grp')].map(g => g.textContent);
  assert(grps.some(g => g.includes('forfatteren')), 'mangler forfatter-gruppe');
  assert(grps.some(g => g.includes('kanon')), 'mangler kanon-gruppe');
  assert(grps.some(g => g.includes('vurderes')), 'mangler uvurderbar-gruppe');
});
await check('QC: funn er en adresse med regel ved siden av', () => {
  assert(document.querySelector('#main .rulebox'), 'mangler målestokk');
  assert(document.querySelectorAll('#main .hit').length === 2, 'mangler treff');
  assert(document.querySelector('#main .mark'), 'treffet er ikke markert');
});
await check('QC: mekaniske målinger og vurderingspass er skilt', () => {
  assert(document.querySelectorAll('#main .met').length === 6, 'mangler mekaniske målinger');
  assert(document.querySelectorAll('#main .passrow').length === 4, 'mangler vurderingspass');
});
await check('QC: filter virker', async () => {
  click('[data-filter="blocker"]'); await settle();
  assert(document.querySelectorAll('#rail .fi').length === 3, 'blokker-filter feil');
  click('[data-filter="all"]'); await settle();
});
await check('QC: fiks-scope valgbart', () => {
  assert(document.querySelectorAll('#ctx .sp').length === 3, 'mangler fiks-scope');
});
await check('QC: kjør vurderingspass', async () => {
  click('[data-pass="regi"]'); await settle();
  assert(document.getElementById('main').innerHTML.includes('kjører · 3-way'), 'pass startet ikke');
});
await check('QC: bokas helse blokkerer utgivelse', () => {
  assert(document.getElementById('ctx').innerHTML.includes('nei'), 'helse-blokk mangler');
});

await check('Kilder rendrer', () => surface('kilder'));
await check('Kilder: hull synes', () => {
  assert(document.querySelector('#main .gapbox'), 'mangler hull-boks');
  assert(document.querySelectorAll('#main .aspect').length === 6, 'mangler aspekter');
  assert(document.querySelectorAll('#main .ast.no').length === 3, 'ikke-minte aspekter merkes ikke');
});
await check('Kilder: eierskap synlig', () => {
  assert(document.getElementById('rail').innerHTML.includes('Kundemateriale'), 'mangler eierskap-skille');
});
await check('Kilder: miner nytt aspekt', async () => {
  click('[data-mine]'); await settle();
  assert(document.getElementById('main').innerHTML.includes('kjører'), 'mining startet ikke');
});
await check('Kilder: bytt kilde', async () => {
  click('[data-source="LSR-ROTHFUSS"]'); await settle();
  assert(document.getElementById('main').innerHTML.includes('Rothfuss'), 'kildebytte feilet');
});

await check('Krysslenker: QC-treff → Library-kapittel', async () => {
  await app.go('qc'); await settle();
  click('#main [data-goto]'); await settle();
  assert(app.mode === 'library', 'navigerte ikke til Library');
});
await check('Krysslenker: Library-funn → QC', async () => {
  click('[data-pick="chapter"][data-pid="LCH-GALDV31D-13"]'); await settle();
  click('#ctx [data-open-finding]'); await settle();
  assert(app.mode === 'qc', 'navigerte ikke til QC');
});

console.log(report.join('\n'));
console.log(`\n${errors.length ? '✗ ' + errors.length + ' feil' : '✓ alle sjekker grønne'}\n`);
process.exit(errors.length ? 1 : 0);
