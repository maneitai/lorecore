import { JSDOM } from 'jsdom';
import fs from 'fs';

const dom = new JSDOM(fs.readFileSync('./index.html','utf8'),
  { url:'https://lore.maneit.net/', runScripts:'outside-only', pretendToBeVisual:true });
global.window=dom.window; global.document=dom.window.document;
global.localStorage=dom.window.localStorage; global.location=dom.window.location;
global.fetch=async()=>{throw new Error('fetch skal ikke kalles i fixture-modus')};
global.structuredClone=v=>JSON.parse(JSON.stringify(v));
global.setInterval=()=>0;

const errors=[], report=[];
const { app } = await import('./js/app.js');
const F = await import('./js/fixtures.js');
document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
const settle=(ms=350)=>new Promise(r=>setTimeout(r,ms));
await settle();

const size=id=>document.getElementById(id).innerHTML.length;
const assert=(c,m)=>{ if(!c) throw new Error(m); };
const click=s=>{ const e=document.querySelector(s); if(!e) throw new Error('fant ikke '+s);
  e.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})); };
async function check(l,f){ try{ await f(); report.push('  ok   '+l);}catch(e){ report.push('  FAIL '+l+' — '+e.message); errors.push(l);} }
async function surface(m,s){ await app.go(m,s); await settle();
  assert(size('rail')>150,'rail tom'); assert(size('main')>150,'main tom');
  assert(document.getElementById('shell').dataset.mode===m,'data-mode feil'); }

console.log('\n── LoreCore smoke (ekte data) ──\n');

await check('fixtures er generert fra live', () =>
  assert(F.meta.generated_from==='live','ikke live-generert'));
await check('7 versjoner i én bokgruppe', () =>
  assert(F.bookGroup.versions.length===7,'feil antall versjoner'));
await check('32 briefs, alle foreldreløse', () => {
  assert(Object.keys(F.briefsByChapterN).length===32,'feil antall briefs');
  assert(Object.values(F.briefsByChapterN).every(b=>b.orphaned),'briefs ikke foreldreløse'); });

await check('Library rendrer', () => surface('library'));
await check('Library: senteret aldri tomt', () =>
  assert(document.querySelector('#main .mh'),'ingen header'));
await check('Library: forfatter-tomrom er handlingsdyktig', () =>
  assert(document.querySelector('#main .empty .btn'),'ingen knapp i tomrommet'));
await check('Library: alle 7 versjoner i nedtrekk', () =>
  assert(document.querySelectorAll('#rail #verpick option').length===7,'feil antall valg'));
await check('Library: badge kun ved avvik', () => {
  const it=[...document.querySelectorAll('#rail .it.sub')];
  assert(it.length>3,'ingen kapitler');
  assert(it.filter(i=>i.querySelector('.tag')).length<it.length,'alle har badge'); });
await check('Library: kapittel viser scene-plan mot prosa', async () => {
  const first=document.querySelector('#rail [data-pick="chapter"]');
  first.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})); await settle();
  assert(document.querySelector('#main .split'),'ingen split');
  assert(document.querySelector('#main .beat'),'ingen scene-plan');
  assert(document.querySelector('#main .prose'),'ingen prosa');
  assert(document.querySelector('#main .excerpt-end'),'utdrag ikke merket'); });
await check('Library: absolutte begrensninger vises', () =>
  assert(document.getElementById('main').innerHTML.includes('no_galdurdal_named')
      || document.querySelectorAll('#main .cond-tag.never').length>0,'ingen constraints'));
await check('Library: foreldreløs brief flagges i kontekst', () =>
  assert(document.getElementById('ctx').innerHTML.includes('book_public_id'),'ikke flagget'));
const pickVersion = async pid => {
  const sl=document.getElementById('verpick'); sl.value=pid;
  sl.dispatchEvent(new dom.window.Event('change',{bubbles:true})); await settle(); };
await check('Library: versjonsbytte laster nye kapitler', async () => {
  await pickVersion('LBK-GALDV2-B1-V31D');
  assert(app.state.bookPid==='LBK-GALDV2-B1-V31D','bookPid ikke byttet'); });
await check('Library: tom versjon gir tom-melding', async () => {
  await pickVersion('LBK-GALDV2-B1');
  assert(document.getElementById('rail').innerHTML.includes('Ingen kapitler'),'mangler tom-melding');
  await pickVersion('LBK-GALDV2-B1-V31A'); });
await check('Library: kanon-verdener i dybdenivåer', async () => {
  click('[data-pick="canon"][data-pid="worlds"]'); await settle();
  assert(document.getElementById('main').innerHTML.includes('hidden_canon'),'mangler hidden_canon'); });
await check('Library: alle 81 verdener listet, ingen skjult', () =>
  assert(document.querySelectorAll('#main .row').length===81,'ikke alle verdener'));
await check('Library: avkortet tekst kan åpnes', async () => {
  const r=document.querySelector('#main .row.has-more');
  assert(r,'ingen utvidbar rad');
  const body=r.nextElementSibling;
  assert(body.hasAttribute('hidden'),'kropp ikke skjult i utgangspunktet');
  r.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})); await settle(60);
  assert(!body.hasAttribute('hidden'),'kropp åpnet seg ikke');
  assert(body.textContent.length>200,'kropp er tom');
  r.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})); await settle(60);
  assert(body.hasAttribute('hidden'),'kropp lukket seg ikke'); });
await check('Library: karakterer flagger manglende cold-felt', async () => {
  click('[data-pick="canon"][data-pid="characters"]'); await settle();
  assert(document.getElementById('ctx').innerHTML.includes('cold'),'R7-mangel ikke nevnt');
  assert(document.querySelectorAll('#main .row.has-more').length>=7,'traits ikke utvidbare'); });
await check('Library: akter er utvidbare', async () => {
  click('[data-pick="acts"]'); await settle();
  assert(document.querySelectorAll('#main .sec').length>=4,'mangler akter');
  assert(document.querySelectorAll('#main .row.has-more').length>=4,'akter ikke utvidbare'); });
await check('Library: kilde med målte tall', async () => {
  click('[data-pick="source"]'); await settle();
  assert(document.querySelector('#main .voicebox'),'ingen trekk'); });

await check('Kilder rendrer', () => surface('kilder'));
await check('Kilder: 9 aspekter fra style_card_json', () =>
  assert(document.querySelectorAll('#main .aspect').length===9,'feil antall aspekter'));
await check('Kilder: ingen hull rapporteres ærlig', () =>
  assert(document.getElementById('main').innerHTML.includes('er minet'),'mangler komplett-melding'));
await check('Kilder: ubrukt kilde tilbyr komponering', () =>
  assert(document.querySelector('#ctx .empty .btn'),'mangler komponer-knapp'));
await check('Kilder: bytt kilde', async () => {
  click('[data-source="' + (await (await import('./js/store.js')).store.sources())[1].public_id + '"]');
  await settle(); assert(document.querySelectorAll('#main .aspect').length===9,'bytte feilet'); });

await check('QC rendrer', () => surface('qc'));
await check('QC: tomt er ikke tomt', () => {
  const h=document.getElementById('main').innerHTML;
  assert(h.includes('Ingen funn registrert'),'mangler tom-tilstand');
  assert(h.includes('no_galdurdal_named'),'viser ikke målbare begrensninger'); });
await check('QC: substrat-tilstand målt', () =>
  assert(document.querySelectorAll('#main .met').length===6,'mangler målinger'));
await check('QC: mekaniske og 3-way pass skilt', () => {
  const h=document.getElementById('main').innerHTML;
  assert(document.querySelectorAll('#main .passrow').length===8,'feil antall pass');
  assert(h.includes('mekanisk')&&h.includes('3-way'),'ikke skilt'); });
await check('QC: severity-filtre matcher basens skala', () => {
  const f=[...document.querySelectorAll('#rail .f')].map(x=>x.textContent);
  assert(f.some(x=>x.includes('kritisk')),'mangler kritisk');
  assert(f.some(x=>x.includes('stil')),'mangler stil'); });
await check('QC: kjør pass', async () => { click('[data-pass]'); await settle(); });

await check('Author rendrer', () => surface('author'));
await check('Author: tom stream forklarer flaten', () =>
  assert(document.getElementById('main').innerHTML.includes('Tenkerommet'),'mangler forklaring'));
await check('Author: skop-tre viser ekte tilstand', () => {
  const h=document.getElementById('ctx').innerHTML;
  assert(document.querySelectorAll('#ctx .tn').length===8,'feil antall noder');
  assert(h.includes('mangler')||h.includes('komplett'),'ingen avledet tilstand'); });
await check('Author: mangler forfatter flagges', () =>
  assert(document.getElementById('ctx').innerHTML.includes('ingen'),'forfatter-mangel ikke flagget'));
await check('Author: deliberasjonsmodus bytter forklaring', async () => {
  click('[data-mode-pick="deep"]'); await settle();
  assert(document.querySelector('#main .dhint').textContent.includes('5 familier'),'hint fulgte ikke'); });
await check('Author: kjør valgt nivå', async () => { click('[data-run-scope]'); await settle(); });

await check('Krysslenke: Library → QC', async () => {
  await app.go('library'); await settle();
  const c=document.querySelector('#rail [data-pick="chapter"]');
  c.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})); await settle();
  click('#ctx [data-open-qc]'); await settle();
  assert(app.mode==='qc','navigerte ikke'); });
await check('Krysslenke: Library → Kilder', async () => {
  await app.go('library',{kind:'source',pid:(await (await import('./js/store.js')).store.sources())[0].public_id});
  await settle(); click('#ctx [data-open-kilder]'); await settle();
  assert(app.mode==='kilder','navigerte ikke'); });

console.log(report.join('\n'));
console.log(`\n${errors.length?'✗ '+errors.length+' feil':'✓ alle sjekker grønne'}\n`);
process.exit(errors.length?1:0);
