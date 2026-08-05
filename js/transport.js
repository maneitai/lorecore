/* LoreCore — transportlag.
   Portert fra deployed page.js. Rører ikke datamodellen, bare HTTP, DOM-hjelpere og varsling. */

export const API_BASE = (() => {
  const q = new URLSearchParams(location.search).get('apiBase');
  if (q) { try { localStorage.setItem('lorecore.apiBase', q); } catch {} return q; }
  try { return localStorage.getItem('lorecore.apiBase') || window.PM_API_BASE || 'https://pm-api.maneit.net'; }
  catch { return 'https://pm-api.maneit.net'; }
})();

export async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

/* ---------- DOM ---------- */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Delegert klikk. Overlever innerHTML-rewrites, som er hele poenget
   siden JS alltid full-rewrites her. */
export function onClick(root, selector, handler) {
  root.addEventListener('click', e => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) handler(t, e);
  });
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const hm = d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `i dag ${hm}`;
  if (d.toDateString() === yest.toDateString()) return `i går ${hm}`;
  return d.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' });
}

export function fmtNum(n) {
  return typeof n === 'number' ? n.toLocaleString('no-NO') : '—';
}

export function fmtMin(mins) {
  if (mins == null) return '—';
  return mins >= 60 ? `~${Math.round(mins / 60)} t` : `~${mins} min`;
}

/* ---------- toast ---------- */

let toastHost = null;
export function toast(msg, kind = '') {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toasts';
    document.body.appendChild(toastHost);
  }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  toastHost.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ---------- modaler ---------- */

function modal({ title, body, actions }) {
  return new Promise(resolve => {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-h">${esc(title)}</div>
        <div class="modal-b">${body}</div>
        <div class="modal-f">${actions.map((a, i) =>
          `<button class="btn ${a.kind || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
      </div>`;
    const close = val => { scrim.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    scrim.addEventListener('click', e => {
      if (e.target === scrim) return close(null);
      const b = e.target.closest('[data-i]');
      if (b) close(actions[+b.dataset.i].value ?? { action: actions[+b.dataset.i].label, root: scrim });
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(scrim);
    const first = scrim.querySelector('textarea, .btn');
    if (first) first.focus();
  });
}

export function confirmModal(title, text, okLabel = 'Fortsett') {
  return modal({
    title,
    body: `<p>${esc(text)}</p>`,
    actions: [
      { label: 'Avbryt', value: false },
      { label: okLabel, kind: 'go', value: true },
    ],
  });
}

/* Overstyring krever grunn — returnerer streng eller null. */
export async function reasonModal(title, text, okLabel = 'Lagre grunn') {
  const scrimResult = await modal({
    title,
    body: `<p>${esc(text)}</p><textarea id="__reason" placeholder="Skriv grunnen. Den lagres på raden og overlever rerun."></textarea>`,
    actions: [
      { label: 'Avbryt', value: null },
      { label: okLabel, kind: 'go' },
    ],
  });
  if (!scrimResult || scrimResult === null) return null;
  const ta = scrimResult.root?.querySelector('#__reason');
  const val = ta ? ta.value.trim() : '';
  return val || null;
}

/* Tre-veis ved navigasjon med ulagrede endringer. */
export function threeWayModal(title, text) {
  return modal({
    title,
    body: `<p>${esc(text)}</p>`,
    actions: [
      { label: 'Avbryt', value: 'cancel' },
      { label: 'Forkast', value: 'discard' },
      { label: 'Lagre og fortsett', kind: 'go', value: 'save' },
    ],
  });
}
