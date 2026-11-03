import { escapeHtml } from './utils.js';

const DISPLAY_CHANNEL = 'ncs-visitor-customer-display-v1';
const DISPLAY_STORAGE_KEY = 'ncs-visitor-display-draft-v1';
const root = document.querySelector('#customer-display');
let channel = null;
let clockTimer = null;
let latestPayload = null;

function esc(value) { return escapeHtml(value); }
function safePhoto(photo) {
  return typeof photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) ? photo : '';
}
function initials(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'V';
}
function markSvg() {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 53 13v17c0 13-8.5 23-21 29C19.5 53 11 43 11 30V13L32 5Z" fill="currentColor" opacity=".15"/><path d="M32 5 53 13v17c0 13-8.5 23-21 29C19.5 53 11 43 11 30V13L32 5Z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="m21 32 7.2 7.2L43 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function brandLockup(subtitle = 'Visitor Desk') {
  return `<div class="brand-lockup"><div class="brand-mark">${markSvg()}</div><div class="brand-copy"><strong>Nigerian Customs Service Visitor</strong><span>${esc(subtitle)}</span></div></div>`;
}
function formatClock() {
  return new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
}
function privacyNotice() {
  return '<div class="privacy-notice"><strong>Data privacy consent notice (NDPA):</strong> By continuing with check-in, you acknowledge and consent to use of your details and photo for visitor management in this demo. Entries stay in this browser only. Please do not enter sensitive personal information.</div>';
}
function idleMarkup() {
  return `<div class="display-shell"><header class="display-header">${brandLockup('Customer display · demo')}<div class="display-clock" id="display-clock">${esc(formatClock())}</div></header>
    <section class="display-content"><div class="display-idle"><div class="brand-mark">${markSvg()}</div><p class="eyebrow">Reception desk</p><h1>Welcome</h1><p>When your host begins your check-in, your visit details will appear here for confirmation.</p>${privacyNotice()}</div></section>
    <footer class="display-footer">Nigerian Customs Service Visitor · DEMO VERSION · Not an official government service</footer></div>`;
}
function dataRow(label, value) {
  return `<div class="display-data-row"><span>${esc(label)}</span><strong>${esc(value || 'Being entered')}</strong></div>`;
}
function visitorMarkup(payload) {
  const visitor = payload?.visitor || {};
  const image = safePhoto(visitor.photo);
  const tagNumber = visitor.tagNumber;
  const checkedIn = payload?.status === 'checked-in';
  const photo = image ? `<img src="${image}" alt="${esc(visitor.name || 'Visitor')} photo">` : `<span class="person-initials">${esc(initials(visitor.name))}</span>`;
  return `<div class="display-shell"><header class="display-header">${brandLockup(checkedIn ? 'Check-in confirmation · demo' : 'Visitor details · demo')}<div class="display-clock" id="display-clock">${esc(formatClock())}</div></header>
    <section class="display-content"><div class="display-visitor"><div class="display-visitor-info"><p class="eyebrow">${checkedIn ? 'Check-in complete' : 'Please confirm your details'}</p><h1>${esc(visitor.name || 'Visitor details')}</h1>
      <div class="display-data">${dataRow('Phone', visitor.phone)}${dataRow('Address', visitor.address)}${dataRow('Host', visitor.host)}${dataRow('Purpose', visitor.purpose)}</div>
      <div class="display-tag"><span>${tagNumber ? 'Assigned tag' : 'Tag assignment'}</span><strong>${tagNumber ? `#${esc(tagNumber)}` : 'Pending'}</strong></div>
    </div><div class="display-photo" aria-label="Visitor photo">${photo}</div></div></section>
    <div class="display-privacy">${privacyNotice()}</div><footer class="display-footer">Please check that the displayed details are correct. · DEMO VERSION</footer></div>`;
}
function render(payload = latestPayload) {
  if (!root) return;
  const age = payload?.sentAt ? Date.now() - Number(payload.sentAt) : Infinity;
  const fresh = age >= 0 && age < 30 * 60 * 1000;
  const hasVisitor = fresh && payload?.status !== 'idle' && payload?.visitor && Object.values(payload.visitor).some((value) => value !== '' && value !== null && value !== undefined);
  root.innerHTML = hasVisitor ? visitorMarkup(payload) : idleMarkup();
}
function receive(payload) {
  if (!payload || payload.type !== 'visitor-draft') return;
  latestPayload = payload;
  render(payload);
}
function readStoredDraft() {
  try {
    const raw = localStorage.getItem(DISPLAY_STORAGE_KEY);
    if (raw) receive(JSON.parse(raw));
  } catch (_) {
    render(null);
  }
}
try {
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(DISPLAY_CHANNEL);
    channel.addEventListener('message', (event) => receive(event.data));
  }
} catch (_) { channel = null; }
window.addEventListener('storage', (event) => {
  if (event.key === DISPLAY_STORAGE_KEY && event.newValue) {
    try { receive(JSON.parse(event.newValue)); } catch (_) { /* Ignore malformed local demo events. */ }
  }
});
window.addEventListener('beforeunload', () => { channel?.close(); if (clockTimer) clearInterval(clockTimer); });
readStoredDraft();
render(latestPayload);
clockTimer = window.setInterval(() => {
  const clock = document.querySelector('#display-clock');
  if (clock) clock.textContent = formatClock();
  if (latestPayload && Date.now() - Number(latestPayload.sentAt) >= 30 * 60 * 1000) render(null);
}, 30_000);
