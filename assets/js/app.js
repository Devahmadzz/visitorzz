import {
  STORAGE_KEY,
  addAudit,
  createId,
  getState,
  loadSampleData,
  resetDemoData,
  saveState,
} from './storage.js';
import {
  compressImage,
  downloadCsv,
  escapeHtml,
  formatDateTime,
  formatDuration,
  formatTime,
  isValidNigerianPhone,
  normalizePhone,
} from './utils.js';

const DISPLAY_CHANNEL = 'ncs-visitor-customer-display-v1';
const DISPLAY_STORAGE_KEY = 'ncs-visitor-display-draft-v1';
const DEMO_ACCOUNTS = {
  Receptionist: { email: 'reception@demo.ngcs', password: 'Desk2026!', name: 'Front Desk' },
  Admin: { email: 'admin@demo.ngcs', password: 'Admin2026!', name: 'Demo Administrator' },
};
const PURPOSES = ['Official', 'Meeting', 'Personal', 'Delivery', 'Enquiry', 'Interview', 'Contractor/Maintenance', 'Other'];
const app = document.querySelector('#app');
let state = getState();
let session = null;
let currentView = 'overview';
let currentStep = 1;
let draft = blankDraft();
let formErrors = {};
let loginError = '';
let insideQuery = '';
let insidePurpose = '';
let reportFilters = { from: '', to: '', officer: '', purpose: '', period: 'daily' };
let modal = null;
let selectedTag = null;
let successVisitId = '';
let cameraStream = null;
let cameraActive = false;
let cameraIssue = '';
let broadcast = null;

function blankDraft() {
  return {
    visitorId: '', name: '', phone: '', address: '', email: '', photo: '',
    returningVisitor: false, host: '', purpose: '', purposeDetail: '',
    groupMembers: [], appointment: 'No', appointmentReference: '',
  };
}

function esc(value) { return escapeHtml(value); }
function initials(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'V';
}
function safePhoto(photo) {
  return typeof photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) ? photo : '';
}
function photoMarkup(photo, name, className = 'person-photo') {
  const src = safePhoto(photo);
  return `<div class="${className}">${src ? `<img src="${src}" alt="${esc(name)} photo">` : `<span>${esc(initials(name))}</span>`}</div>`;
}
function markSvg() {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 53 13v17c0 13-8.5 23-21 29C19.5 53 11 43 11 30V13L32 5Z" fill="currentColor" opacity=".15"/><path d="M32 5 53 13v17c0 13-8.5 23-21 29C19.5 53 11 43 11 30V13L32 5Z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="m21 32 7.2 7.2L43 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function brandLockup(subtitle = 'Visitor Desk') {
  return `<div class="brand-lockup"><div class="brand-mark">${markSvg()}</div><div class="brand-copy"><strong>Nigerian Customs<br class="brand-break"> Service Visitor</strong><span>${esc(subtitle)}</span></div></div>`;
}
function toast(message, type = 'success') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    document.body.append(region);
  }
  const item = document.createElement('div');
  item.className = `toast${type === 'error' ? ' error' : ''}`;
  item.textContent = message;
  region.append(item);
  window.setTimeout(() => item.remove(), 3400);
}
function commit(action, details = '') {
  if (session) addAudit(state, session.name, action, details);
  state = saveState(state);
}
function persist() { state = saveState(state); }
function isAdmin() { return session?.role === 'Admin'; }
function appDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function activeVisits() {
  return state.visits.filter((visit) => !visit.checkOut);
}
function visitorFor(visit) {
  return state.visitors.find((visitor) => visitor.id === visit.visitorId) || { name: 'Visitor', phone: '', address: '', email: '' };
}
function tagInfo(number) {
  const n = Number(number);
  const active = activeVisits().find((visit) => Number(visit.tagNumber) === n);
  if (active) return { status: 'in-use', visit: active, visitor: visitorFor(active), tag: state.tags.find((item) => Number(item.number) === n) };
  const tag = state.tags.find((item) => Number(item.number) === n);
  if (tag?.status === 'unavailable' && tag.reason !== 'Issued to an active visit') {
    return { status: 'unavailable', tag };
  }
  return { status: 'available', tag };
}
function tagCounts() {
  const count = Math.max(0, Number(state.settings?.tagCount) || 0);
  let available = 0;
  let inUse = 0;
  let unavailable = 0;
  for (let number = 1; number <= count; number += 1) {
    const status = tagInfo(number).status;
    if (status === 'in-use') inUse += 1;
    else if (status === 'unavailable') unavailable += 1;
    else available += 1;
  }
  return { count, available, inUse, unavailable };
}
function setDraftField(field, value) {
  draft[field] = value;
  if (field === 'phone') matchReturningVisitor(value);
  if (['name', 'phone', 'address', 'email', 'host', 'purpose', 'purposeDetail'].includes(field)) broadcastDraft();
}
function matchReturningVisitor(phone) {
  const key = normalizePhone(phone);
  const match = key ? state.visitors.find((visitor) => normalizePhone(visitor.phone) === key) : null;
  if (match) {
    draft.visitorId = match.id;
    draft.returningVisitor = true;
    draft.name = match.name || '';
    draft.address = match.address || '';
    draft.email = match.email || '';
    const nameField = document.querySelector('[data-draft="name"]');
    const addressField = document.querySelector('[data-draft="address"]');
    const emailField = document.querySelector('[data-draft="email"]');
    if (nameField) nameField.value = draft.name;
    if (addressField) addressField.value = draft.address;
    if (emailField) emailField.value = draft.email;
  } else {
    const hadReturningMatch = Boolean(draft.visitorId || draft.returningVisitor);
    draft.visitorId = '';
    draft.returningVisitor = false;
    if (hadReturningMatch) {
      draft.name = '';
      draft.address = '';
      draft.email = '';
      const nameField = document.querySelector('[data-draft="name"]');
      const addressField = document.querySelector('[data-draft="address"]');
      const emailField = document.querySelector('[data-draft="email"]');
      if (nameField) nameField.value = '';
      if (addressField) addressField.value = '';
      if (emailField) emailField.value = '';
    }
  }
  const slot = document.querySelector('#returning-slot');
  if (slot) slot.innerHTML = draft.returningVisitor ? '<span class="returning-banner">Returning visitor</span>' : '';
  broadcastDraft();
}
function hostSelection() {
  const entered = String(draft.host || '').trim();
  const officer = state.officers.find((item) => entered === item.name || entered === `${item.name} — ${item.department}` || entered === `${item.name} - ${item.department}`);
  if (officer) return { host: officer.name, hostId: officer.id, department: officer.department };
  return { host: entered, hostId: entered ? 'custom' : '', department: 'Office' };
}
function purposeLabel() {
  if (draft.purpose === 'Other' && draft.purposeDetail.trim()) return `Other: ${draft.purposeDetail.trim()}`;
  return draft.purpose || '';
}
function broadcastDraft(status = 'draft', tagNumber = null) {
  const host = hostSelection();
  const payload = {
    type: 'visitor-draft',
    status,
    sentAt: Date.now(),
    visitor: {
      name: draft.name || '', phone: draft.phone || '', address: draft.address || '',
      host: host.host || '', purpose: purposeLabel(), photo: safePhoto(draft.photo),
      tagNumber: tagNumber || null,
    },
  };
  try { broadcast?.postMessage(payload); } catch (_) { /* Best-effort display mirror. */ }
  try { localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(payload)); } catch (_) { /* BroadcastChannel may still work. */ }
}
function broadcastIdle() {
  const payload = { type: 'visitor-draft', status: 'idle', sentAt: Date.now(), visitor: {} };
  try { broadcast?.postMessage(payload); } catch (_) { /* Best effort. */ }
  try { localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(payload)); } catch (_) { /* Best effort. */ }
}
function startNewCheckin() {
  stopCamera();
  draft = blankDraft();
  formErrors = {};
  currentStep = 1;
  successVisitId = '';
  selectedTag = null;
  modal = null;
  cameraIssue = '';
  currentView = 'checkin';
  broadcastIdle();
  render();
  window.setTimeout(() => document.querySelector('[data-draft="phone"]')?.focus(), 40);
}
function logout() {
  stopCamera();
  session = null;
  currentView = 'overview';
  draft = blankDraft();
  modal = null;
  successVisitId = '';
  broadcastIdle();
  render();
}
function loginAs(role) {
  const account = DEMO_ACCOUNTS[role];
  if (!account) return;
  session = { role, name: account.name, email: account.email };
  loginError = '';
  currentView = 'overview';
  state = getState();
  addAudit(state, session.name, 'Signed in', `Role: ${role}`);
  state = saveState(state);
  render();
}
function renderLogin() {
  const r = DEMO_ACCOUNTS.Receptionist;
  const a = DEMO_ACCOUNTS.Admin;
  return `<main class="login-page">
    <section class="login-aside">
      ${brandLockup('Visitor management demo')}
      <div class="login-copy"><p class="eyebrow">Reception desk • visitor control</p><h1>A clear welcome.<br>A confident check-in.</h1><p>Manage arrivals, assign entry tags, and keep the visitor journey visible from the front desk to the customer display.</p></div>
      <p class="login-foot">Browser-local demonstration · Not an official government service</p>
    </section>
    <section class="login-main">
      <div class="login-card">
        <p class="eyebrow">Demo access</p><h2>Sign in to the visitor desk</h2><p class="subtle">Choose a role to explore the reception or administration workflow.</p>
        ${loginError ? `<div class="form-alert" role="alert">${esc(loginError)}</div>` : ''}
        <form id="login-form" novalidate>
          <div class="form-grid">
            <div class="field full"><label for="login-role">Role</label><select id="login-role" name="role"><option>Receptionist</option><option>Admin</option></select></div>
            <div class="field full"><label for="login-email">Demo email</label><input id="login-email" name="email" type="email" autocomplete="username" value="${esc(r.email)}" required></div>
            <div class="field full"><label for="login-password">Demo password</label><input id="login-password" name="password" type="password" autocomplete="current-password" value="${esc(r.password)}" required></div>
          </div>
          <div style="margin-top:18px"><button class="btn btn-primary btn-block" type="submit">Sign in <span aria-hidden="true">→</span></button></div>
        </form>
        <div class="demo-credentials" aria-label="Demo accounts">
          <div class="credential-card"><div><strong>Receptionist account</strong><code>${esc(r.email)}<br>${esc(r.password)}</code></div><button class="btn btn-secondary btn-small" type="button" data-action="quick-login" data-role="Receptionist">Use</button></div>
          <div class="credential-card"><div><strong>Admin account</strong><code>${esc(a.email)}<br>${esc(a.password)}</code></div><button class="btn btn-secondary btn-small" type="button" data-action="quick-login" data-role="Admin">Use</button></div>
        </div>
        <p class="credentials-warning">Demo credentials are intentionally visible. Do not use real visitor details or passwords. Data is stored only in this browser.</p>
      </div>
    </section>
  </main>`;
}
const NAV = [
  ['overview', 'Overview', '⌂'], ['checkin', 'New check-in', '+'], ['inside', 'Visitors inside', '◉'],
  ['tags', 'Tag board', '▦'], ['reports', 'Reports', '▤'], ['settings', 'Settings & audit', '⚙'],
];
function renderSidebar() {
  const count = tagCounts();
  const visible = NAV.filter(([id]) => !['reports', 'settings'].includes(id) || isAdmin());
  return `<aside class="sidebar">
    ${brandLockup('Visitor desk')}
    <p class="sidebar-section-label">Workspace</p>
    <nav class="side-nav" aria-label="Main navigation">${visible.map(([id, title, icon]) => `<button type="button" class="nav-link${currentView === id ? ' active' : ''}" data-action="navigate" data-view="${id}" ${currentView === id ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${title}</span>${id === 'inside' ? `<span class="nav-badge">${activeVisits().length}</span>` : ''}${id === 'tags' ? `<span class="nav-badge">${count.available}/${count.count}</span>` : ''}</button>`).join('')}</nav>
    <div class="sidebar-bottom"><p>Demo records are kept in this browser. Visitor information does not sync to other computers.</p></div>
  </aside>`;
}
function pageTitle(view) {
  return ({ overview: 'Overview', checkin: 'Visitor check-in', inside: 'Visitors inside', tags: 'Tag board', reports: 'Reports', settings: 'Settings & audit' })[view] || 'Overview';
}
function renderTopbar() {
  const date = new Intl.DateTimeFormat('en-NG', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());
  return `<header class="topbar"><div class="topbar-left"><div><div class="topbar-title">${esc(pageTitle(currentView))}</div><div class="topbar-meta">${esc(date)} · Visitor desk demo</div></div></div>
    <div class="topbar-actions"><button class="btn btn-secondary btn-small" type="button" data-action="open-display"><span aria-hidden="true">▣</span> Open customer display</button><div class="user-chip"><div class="user-avatar">${esc(initials(session?.name))}</div><div><strong>${esc(session?.name || '')}</strong><span>${esc(session?.role || '')}</span></div></div><button class="icon-button" type="button" title="Sign out" aria-label="Sign out" data-action="logout">↗</button></div>
  </header>`;
}
function renderApp() {
  if (!session) return renderLogin();
  let content;
  if (currentView === 'checkin') content = renderCheckin();
  else if (currentView === 'inside') content = renderInside();
  else if (currentView === 'tags') content = renderTags();
  else if (currentView === 'reports' && isAdmin()) content = renderReports();
  else if (currentView === 'settings' && isAdmin()) content = renderSettings();
  else content = renderOverview();
  return `<div class="app-shell">${renderSidebar()}<div class="main-column">${renderTopbar()}<main class="page-content">${content}</main></div></div>${renderModal()}<div class="toast-region" role="status" aria-live="polite"></div>`;
}
function heading(eyebrow, title, subtitle, actions = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p class="subtle">${esc(subtitle)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}
function statCard(label, value, note, icon) {
  return `<article class="stat-card"><div class="stat-label"><span>${esc(label)}</span><span class="stat-icon" aria-hidden="true">${icon}</span></div><div class="stat-value">${esc(value)}</div><div class="stat-note">${esc(note)}</div></article>`;
}
function currentDayVisits() {
  const key = new Date().toLocaleDateString('en-CA');
  return state.visits.filter((visit) => new Date(visit.checkIn).toLocaleDateString('en-CA') === key).length;
}
function averageDuration() {
  const complete = state.visits.filter((visit) => visit.checkOut && appDate(visit.checkIn) && appDate(visit.checkOut));
  if (!complete.length) return '—';
  const minutes = complete.reduce((sum, visit) => sum + Math.max(0, (new Date(visit.checkOut) - new Date(visit.checkIn)) / 60000), 0) / complete.length;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  return `${Math.round(minutes)}m`;
}
function renderOverview() {
  const counts = tagCounts();
  const active = activeVisits().sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn)).slice(0, 6);
  const actions = `<button class="btn btn-primary" type="button" data-action="start-checkin">+ Start a visitor check-in</button>`;
  return `${heading('Front desk snapshot', `Good day, ${esc(session.name.split(' ')[0])}`, 'Monitor arrivals, tag availability, and visitors currently inside.', actions)}
    <section class="card-grid" aria-label="Visitor desk summary">
      ${statCard('Visits today', String(currentDayVisits()), 'All check-ins recorded today', '↗')}
      ${statCard('Currently inside', String(activeVisits().length), 'Visitors not yet checked out', '◉')}
      ${statCard('Tags available', String(counts.available), `${counts.inUse} in use · ${counts.unavailable} unavailable`, '▦')}
      ${statCard('Average visit', averageDuration(), 'Completed visits in this demo', '◷')}
    </section>
    <div class="content-grid">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Visitors currently inside</h2><p class="subtle small">Live list · ${activeVisits().length} active visit${activeVisits().length === 1 ? '' : 's'}</p></div><button class="btn btn-secondary btn-small" data-action="navigate" data-view="inside">View all</button></div>${renderInsideTable(active, false)}</section>
      <div class="stack"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">End-of-day tag check</h2><p class="subtle small">Tags still assigned to active visits</p></div><span class="status-pill${active.length ? ' amber' : ' green'}">${activeVisits().length} in use</span></div>${renderEndDay()}</section>
      ${isAdmin() ? `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Recent audit activity</h2><p class="subtle small">Admin-visible record of demo actions</p></div><button class="btn btn-quiet btn-small" data-action="navigate" data-view="settings">Open audit log →</button></div>${renderAuditList(5)}</section>` : `<section class="panel"><h2 class="panel-title">Customer display</h2><p class="subtle">Open the second-screen display beside the reception desk. Visitor details typed in the check-in wizard mirror there in real time.</p><button class="btn btn-secondary btn-small" type="button" data-action="open-display">Open customer display ↗</button></section>`}</div>
    </div>`;
}
function renderEndDay() {
  const list = activeVisits().sort((a, b) => a.tagNumber - b.tagNumber);
  if (!list.length) return `<div class="empty-state"><div class="empty-state-icon">✓</div><strong>All tags are accounted for</strong><p>No visitors are currently holding a tag.</p></div>`;
  return `<div class="end-day-list">${list.map((visit) => `<div class="end-day-row"><span><strong>Tag ${esc(visit.tagNumber)}</strong> · ${esc(visitorFor(visit).name)}</span><span>${esc(formatTime(visit.checkIn))}</span></div>`).join('')}</div>`;
}
function renderInsideTable(list = activeVisits(), showCheckout = true) {
  if (!list.length) return `<div class="empty-state"><div class="empty-state-icon">◉</div><strong>No active visitors</strong><p>When a visitor is checked in, their record and assigned tag will appear here.</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Visitor</th><th>Host</th><th>Purpose</th><th>Tag</th><th>Checked in</th><th>Duration</th>${showCheckout ? '<th>Action</th>' : ''}</tr></thead><tbody>${list.map((visit) => {
    const visitor = visitorFor(visit);
    return `<tr><td><div class="person-cell">${photoMarkup(visit.photo || visitor.photo, visitor.name)}<div><strong>${esc(visitor.name)}</strong><span>${esc(visitor.phone || '')}</span></div></div></td><td>${esc(visit.host || '—')}<div class="small subtle">${esc(visit.department || '')}</div></td><td>${esc(visit.purpose || '—')}${visit.purposeDetail ? `<div class="small subtle">${esc(visit.purposeDetail)}</div>` : ''}</td><td><span class="tag-number">${esc(visit.tagNumber)}</span></td><td>${esc(formatTime(visit.checkIn))}</td><td class="mono">${esc(formatDuration(visit.checkIn, null))}</td>${showCheckout ? `<td><button class="btn btn-danger btn-small" type="button" data-action="checkout" data-visit="${esc(visit.id)}">Check out</button></td>` : ''}</tr>`;
  }).join('')}</tbody></table></div>`;
}
function renderInside() {
  const actions = `<button class="btn btn-primary" type="button" data-action="start-checkin">+ New check-in</button>`;
  return `${heading('Live visitor register', 'Visitors inside', 'Search active visits and check out visitors to free their assigned tags.', actions)}
    <section class="card-grid" style="margin-bottom:16px">${statCard('Visitors inside', String(activeVisits().length), 'Active visits', '◉')}${statCard('Available tags', String(tagCounts().available), 'Ready for the next arrival', '▦')}${statCard('Tags in use', String(tagCounts().inUse), 'Must be checked out to free', '●')}${statCard('Total tag capacity', String(tagCounts().count), 'Configured tag numbers', '№')}</section>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Live visitor list</h2><p class="subtle small">${tagCounts().available} available / ${tagCounts().inUse} in use</p></div><span class="status-pill green">Live</span></div>
      <div class="table-toolbar"><div class="search-box"><input class="filter-control" id="inside-search" type="search" placeholder="Search visitor, phone, or host" value="${esc(insideQuery)}" aria-label="Search active visitors"></div><select class="filter-control" id="inside-purpose-filter" aria-label="Filter by purpose"><option value="">All purposes</option>${state.purposes.map((purpose) => `<option value="${esc(purpose)}" ${insidePurpose === purpose ? 'selected' : ''}>${esc(purpose)}</option>`).join('')}</select></div>
      <div id="inside-table-container">${renderInsideTable(filterActive())}</div>
    </section>`;
}
function filterActive() {
  const query = insideQuery.trim().toLowerCase();
  return activeVisits().filter((visit) => {
    const visitor = visitorFor(visit);
    const textMatch = !query || [visitor.name, visitor.phone, visit.host, visit.department, visit.purpose].some((item) => String(item || '').toLowerCase().includes(query));
    return textMatch && (!insidePurpose || visit.purpose === insidePurpose);
  });
}
function renderCheckin() {
  if (successVisitId) {
    const visit = state.visits.find((item) => item.id === successVisitId);
    if (visit) {
      const visitor = visitorFor(visit);
      return `${heading('Check-in complete', 'Visitor registered', 'The assigned tag is now in use. The customer display shows the check-in details.', '')}
        <div class="wizard-wrap"><section class="wizard-card"><div class="confirmation-box"><div class="confirmation-check">✓</div><div><strong>${esc(visitor.name)} is checked in</strong><span>Check-in time ${esc(formatDateTime(visit.checkIn))} · Tag ${esc(visit.tagNumber)}</span></div></div>
          <div class="content-grid" style="margin-top:20px"><div class="panel">${photoMarkup(visit.photo, visitor.name, 'display-photo')}<p class="eyebrow" style="margin-top:15px">Visitor details</p><h2>${esc(visitor.name)}</h2><p class="subtle">${esc(visitor.phone)} · ${esc(visitor.address)}</p><p class="subtle">Visiting ${esc(visit.host)} · ${esc(visit.purpose)}${visit.purposeDetail ? ` — ${esc(visit.purposeDetail)}` : ''}</p></div><div class="panel"><p class="eyebrow">Assigned entry tag</p><div class="display-tag"><span>Tag number</span><strong>${esc(visit.tagNumber)}</strong></div><p class="subtle" style="margin-top:14px">The visitor display remains on the confirmation until the next check-in begins.</p></div></div>
          <div class="form-actions"><button class="btn btn-secondary" type="button" data-action="navigate" data-view="inside">View visitors inside</button><button class="btn btn-primary" type="button" data-action="start-checkin">Start another check-in →</button></div></section></div>`;
    }
    successVisitId = '';
  }
  return `${heading(`Reception · Step ${currentStep} of 3`, 'New visitor check-in', 'Capture visitor details, take a photo, and assign an available entry tag.', `<button class="btn btn-secondary btn-small" type="button" data-action="open-display">▣ Open customer display</button>`)}
    <div class="wizard-wrap">
      <div class="wizard-progress" aria-label="Check-in progress">${[['Visitor details', 'Identity & contact'], ['Photo', 'Visitor portrait'], ['Visit details', 'Host & purpose']].map(([title, hint], index) => { const step = index + 1; const status = step === currentStep ? 'active' : step < currentStep ? 'done' : ''; return `<div class="wizard-step ${status}" ${step === currentStep ? 'aria-current="step"' : ''}><span class="wizard-step-number">${step < currentStep ? '✓' : step}</span><div><strong>${title}</strong><small>${hint}</small></div></div>`; }).join('')}</div>
      ${currentStep === 1 ? renderStepOne() : currentStep === 2 ? renderStepTwo() : renderStepThree()}
    </div>`;
}
function renderStepOne() {
  const error = (key) => formErrors[key] ? `<span class="field-error">${esc(formErrors[key])}</span>` : '';
  return `<form id="step-one-form" class="wizard-card" novalidate><div class="wizard-card-header"><div><p class="eyebrow">Step 1 · Visitor details</p><h2>Who is visiting today?</h2><p class="subtle">Enter a Nigerian phone number to find returning visitor details.</p></div><div id="returning-slot">${draft.returningVisitor ? '<span class="returning-banner">Returning visitor</span>' : ''}</div></div>
    ${formErrors.general ? `<div class="form-alert" role="alert">${esc(formErrors.general)}</div>` : ''}
    <div class="form-grid"><div class="field ${formErrors.phone ? 'invalid' : ''}"><label for="visitor-phone">Phone number <span class="required-mark">*</span></label><input id="visitor-phone" data-draft="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567 or +234 803 123 4567" value="${esc(draft.phone)}" required aria-describedby="phone-hint"><span class="field-hint" id="phone-hint">Use a Nigerian mobile number, for example 0803… or +234…</span>${error('phone')}</div>
      <div class="field ${formErrors.name ? 'invalid' : ''}"><label for="visitor-name">Visitor name <span class="required-mark">*</span></label><input id="visitor-name" data-draft="name" type="text" autocomplete="name" placeholder="Full name" value="${esc(draft.name)}" required>${error('name')}</div>
      <div class="field full ${formErrors.address ? 'invalid' : ''}"><label for="visitor-address">Address <span class="required-mark">*</span></label><input id="visitor-address" data-draft="address" type="text" autocomplete="street-address" placeholder="Street, city, state" value="${esc(draft.address)}" required>${error('address')}</div>
      <div class="field ${formErrors.email ? 'invalid' : ''}"><label for="visitor-email">Email <span class="subtle">(optional)</span></label><input id="visitor-email" data-draft="email" type="email" autocomplete="email" placeholder="name@example.com" value="${esc(draft.email)}">${error('email')}</div>
      <div class="field"><label>Privacy notice</label><div class="camera-note">Please collect only the information needed for visitor management. This demo stores records in the current browser.</div></div></div>
    <div class="form-actions"><span class="subtle small">Fields marked * are required</span><button class="btn btn-primary" type="submit">Continue to photo <span aria-hidden="true">→</span></button></div></form>`;
}
function renderStepTwo() {
  const preview = draft.photo
    ? `<img src="${safePhoto(draft.photo)}" alt="Captured visitor photo">`
    : cameraActive ? '<video id="camera-video" autoplay muted playsinline aria-label="Live camera preview"></video>' : `<div class="camera-placeholder"><div class="empty-state-icon">◎</div><strong>Visitor photo</strong><p class="subtle small">Start the webcam or upload a photo from this device.</p></div>`;
  const status = cameraIssue ? `<div class="form-alert" role="status">${esc(cameraIssue)} You can upload an image instead.</div>` : '';
  return `<form id="step-two-form" class="wizard-card" novalidate><div class="wizard-card-header"><div><p class="eyebrow">Step 2 · Visitor photo</p><h2>Capture a visitor photo</h2><p class="subtle">A photo is required before continuing to visit details.</p></div>${draft.photo ? '<span class="status-pill green">Photo ready</span>' : '<span class="status-pill">Photo required</span>'}</div>
    ${status}<div class="camera-stage"><div class="camera-box">${preview}</div><div class="camera-controls">
      ${draft.photo ? `<button class="btn btn-secondary" type="button" data-action="retake-photo">↻ Retake photo</button><label class="btn btn-secondary" for="photo-upload">Choose another image</label>` : `<button class="btn btn-primary" type="button" data-action="start-camera">◎ Start camera</button><button class="btn btn-secondary" type="button" data-action="capture-photo" ${cameraActive ? '' : 'disabled'}>Capture photo</button><label class="btn btn-secondary" for="photo-upload">Upload an image</label>`}
      <input id="photo-upload" type="file" accept="image/*" hidden>
      <div class="camera-note">Camera access is requested only when you choose Start camera. If permission or hardware is unavailable, upload an image instead. The photo is resized and saved as JPEG in this browser.</div>
    </div></div>
    ${formErrors.general ? `<div class="form-alert" style="margin-top:14px">${esc(formErrors.general)}</div>` : ''}
    <div class="form-actions"><button class="btn btn-secondary" type="button" data-action="wizard-back">← Back</button><button class="btn btn-primary" type="submit">Continue to visit details <span aria-hidden="true">→</span></button></div></form>`;
}
function renderStepThree() {
  const purposes = state.purposes.length ? state.purposes : PURPOSES;
  return `<form id="step-three-form" class="wizard-card" novalidate><div class="wizard-card-header"><div><p class="eyebrow">Step 3 · Visit details</p><h2>Where is the visitor going?</h2><p class="subtle">Choose the host, purpose, group size, and appointment details.</p></div><span class="status-pill blue">${state.officers.length} hosts</span></div>
    ${formErrors.general ? `<div class="form-alert" role="alert">${esc(formErrors.general)}</div>` : ''}
    <div class="form-grid"><div class="field ${formErrors.host ? 'invalid' : ''}"><label for="visit-host">Office or officer to visit <span class="required-mark">*</span></label><input id="visit-host" data-draft="host" list="officer-options" autocomplete="off" placeholder="Search officer or department" value="${esc(draft.host)}" required><datalist id="officer-options">${state.officers.map((officer) => `<option value="${esc(`${officer.name} — ${officer.department}`)}"></option>`).join('')}${state.departments.map((department) => `<option value="${esc(department)} — Office"></option>`).join('')}</datalist>${formErrors.host ? `<span class="field-error" style="display:block">${esc(formErrors.host)}</span>` : '<span class="field-hint">Start typing to search seeded officers and departments.</span>'}</div>
      <div class="field ${formErrors.purpose ? 'invalid' : ''}"><label for="visit-purpose">Purpose of visit <span class="required-mark">*</span></label><select id="visit-purpose" data-draft="purpose" required><option value="">Select a purpose</option>${purposes.map((purpose) => `<option value="${esc(purpose)}" ${draft.purpose === purpose ? 'selected' : ''}>${esc(purpose)}</option>`).join('')}</select>${formErrors.purpose ? `<span class="field-error" style="display:block">${esc(formErrors.purpose)}</span>` : ''}</div>
      <div class="field full" id="other-purpose-wrap" ${draft.purpose === 'Other' ? '' : 'hidden'}><label for="purpose-detail">Specify other purpose <span class="required-mark">*</span></label><input id="purpose-detail" data-draft="purposeDetail" type="text" placeholder="Describe the purpose" value="${esc(draft.purposeDetail)}">${formErrors.purposeDetail ? `<span class="field-error" style="display:block">${esc(formErrors.purposeDetail)}</span>` : ''}</div>
      <div class="field"><label for="appointment">Appointment?</label><select id="appointment" data-draft="appointment"><option ${draft.appointment === 'No' ? 'selected' : ''}>No</option><option ${draft.appointment === 'Yes' ? 'selected' : ''}>Yes</option></select></div>
      <div class="field" id="appointment-reference-wrap" ${draft.appointment === 'Yes' ? '' : 'hidden'}><label for="appointment-reference">Appointment reference</label><input id="appointment-reference" data-draft="appointmentReference" type="text" placeholder="Reference number" value="${esc(draft.appointmentReference)}"></div>
    </div>
    <div style="margin-top:21px"><div class="panel-header"><div><h3>Additional visitors</h3><p class="subtle small">Add group members accompanying the primary visitor.</p></div><button type="button" class="btn btn-secondary btn-small" data-action="add-group-member">+ Add person</button></div>
      ${draft.groupMembers.length ? `<div class="group-rows">${draft.groupMembers.map((member, index) => `<div class="group-row"><div class="field"><label for="member-name-${index}">Name</label><input id="member-name-${index}" data-member-index="${index}" data-member-field="name" value="${esc(member.name)}" placeholder="Full name"></div><div class="field"><label for="member-phone-${index}">Phone</label><input id="member-phone-${index}" data-member-index="${index}" data-member-field="phone" value="${esc(member.phone)}" placeholder="0803…" inputmode="tel">${formErrors[`member-${index}`] ? `<span class="field-error" style="display:block">${esc(formErrors[`member-${index}`])}</span>` : ''}</div><button class="btn btn-danger btn-small" type="button" data-action="remove-group-member" data-index="${index}" aria-label="Remove additional visitor">Remove</button></div>`).join('')}</div>` : '<p class="subtle small">No additional visitors added.</p>'}
    </div>
    <div class="form-actions"><button class="btn btn-secondary" type="button" data-action="wizard-back">← Back</button><button class="btn btn-primary" type="submit">Assign tag <span aria-hidden="true">→</span></button></div></form>`;
}
function renderTags() {
  const counts = tagCounts();
  const actions = isAdmin() ? '<button class="btn btn-secondary" type="button" data-action="navigate" data-view="settings">Manage tag count</button>' : '';
  const list = Array.from({ length: counts.count }, (_, index) => index + 1);
  return `${heading('Entry tag inventory', 'Tag board', 'Available tags are green, assigned tags are red, and unavailable tags are amber.', actions)}
    <section class="panel"><div class="tag-board-toolbar"><div class="tag-legend"><span><i class="legend-dot"></i>${counts.available} available</span><span><i class="legend-dot red"></i>${counts.inUse} in use</span><span><i class="legend-dot amber"></i>${counts.unavailable} unavailable</span></div><span class="status-pill">${counts.count} tags total</span></div>
      <div class="tag-grid">${list.map((number) => { const info = tagInfo(number); const cls = info.status === 'in-use' ? 'in-use' : info.status === 'unavailable' ? 'unavailable' : 'available'; const who = info.visitor?.name || (info.status === 'unavailable' ? info.tag?.reason || 'Unavailable' : 'Available'); return `<button type="button" class="tag-tile ${cls}" data-action="tag-details" data-tag-number="${number}" title="${esc(info.status === 'in-use' ? `In use by ${who}` : who)}" ${info.status === 'in-use' && !isAdmin() ? '' : ''}><strong>${number}</strong><span>${cls === 'in-use' ? esc(who.split(' ')[0]) : cls === 'unavailable' ? 'Unavailable' : 'Available'}</span></button>`; }).join('')}</div>
    </section><div class="content-grid"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">End-of-day panel</h2><p class="subtle small">Tags still in use</p></div></div>${renderEndDay()}</section><section class="panel"><h2 class="panel-title">Tag handling</h2><p class="subtle">Checking out a visitor frees their tag. Admins can open any tag to mark it unavailable or restore it.</p>${isAdmin() ? '<p class="subtle small">Use tag details to record a lost or unavailable tag, then restore it once it is returned.</p>' : '<span class="status-pill blue">Admin action required to change availability</span>'}</section></div>`;
}
function filteredReportVisits() {
  const from = reportFilters.from ? new Date(`${reportFilters.from}T00:00:00`) : null;
  const to = reportFilters.to ? new Date(`${reportFilters.to}T23:59:59`) : null;
  return state.visits.filter((visit) => {
    const date = appDate(visit.checkIn);
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    if (reportFilters.officer && visit.hostId !== reportFilters.officer) return false;
    if (reportFilters.purpose && visit.purpose !== reportFilters.purpose) return false;
    return true;
  }).sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
}
function renderReportChart(visits) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (13 - index)); date.setHours(0, 0, 0, 0);
    return { date, key: date.toLocaleDateString('en-CA'), count: 0 };
  });
  for (const visit of visits) {
    const key = new Date(visit.checkIn).toLocaleDateString('en-CA');
    const match = days.find((day) => day.key === key);
    if (match) match.count += 1;
  }
  const max = Math.max(1, ...days.map((day) => day.count));
  return `<div class="chart-bars" role="img" aria-label="Visits per day over the last 14 days">${days.map((day) => { const height = Math.max(3, Math.round((day.count / max) * 120)); const label = new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short' }).format(day.date); return `<div class="chart-day"><span class="chart-count">${day.count || ''}</span><div class="chart-bar" style="height:${height}px" title="${esc(label)}: ${day.count} visit${day.count === 1 ? '' : 's'}"></div><span class="chart-label">${esc(label)}</span></div>`; }).join('')}</div>`;
}
function renderDailyReport(visits) {
  if (!visits.length) return `<div class="empty-state"><div class="empty-state-icon">▤</div><strong>No visits match these filters</strong><p>Adjust the date range, officer, or purpose filters.</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Visitor</th><th>Host</th><th>Purpose</th><th>Tag</th><th>Check-in</th><th>Check-out</th><th>Duration</th></tr></thead><tbody>${visits.map((visit) => { const visitor = visitorFor(visit); return `<tr><td><div class="person-cell">${photoMarkup(visit.photo, visitor.name)}<div><strong>${esc(visitor.name)}</strong><span>${esc(visitor.phone)}</span></div></div></td><td>${esc(visit.host || '—')}<div class="small subtle">${esc(visit.department || '')}</div></td><td>${esc(visit.purpose)}${visit.purposeDetail ? `<div class="small subtle">${esc(visit.purposeDetail)}</div>` : ''}</td><td><span class="tag-number">${esc(visit.tagNumber)}</span></td><td>${esc(formatDateTime(visit.checkIn))}</td><td>${esc(formatDateTime(visit.checkOut))}</td><td class="mono">${esc(formatDuration(visit.checkIn, visit.checkOut || null))}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function renderMonthlyReport(visits) {
  if (!visits.length) return `<div class="empty-state"><div class="empty-state-icon">▤</div><strong>No monthly visits to show</strong><p>Adjust the filters to view another period.</p></div>`;
  const groups = new Map();
  for (const visit of visits) {
    const date = new Date(visit.checkIn);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('en-NG', { month: 'long', year: 'numeric' }).format(date);
    if (!groups.has(key)) groups.set(key, { label, count: 0, completed: 0, active: 0 });
    const group = groups.get(key); group.count += 1; if (visit.checkOut) group.completed += 1; else group.active += 1;
  }
  return `<div class="month-list">${Array.from(groups.values()).map((group) => `<div class="month-row"><strong>${esc(group.label)}</strong><span>${group.count} visit${group.count === 1 ? '' : 's'} · ${group.completed} completed · ${group.active} active</span></div>`).join('')}</div>`;
}
function renderReports() {
  const visits = filteredReportVisits();
  const today = currentDayVisits();
  return `${heading('Admin workspace', 'Visit reports', 'Review daily and monthly visitor logs, filter records, and export a CSV.', `<button class="btn btn-secondary" type="button" data-action="print-report">⎙ Print view</button><button class="btn btn-primary" type="button" data-action="export-report">↓ Export CSV</button>`)}
    <section class="card-grid" style="margin-bottom:16px">${statCard('Visits today', String(today), 'All visits checked in today', '↗')}${statCard('Currently inside', String(activeVisits().length), 'Visitors with active check-ins', '◉')}${statCard('Average duration', averageDuration(), 'Completed visits only', '◷')}${statCard('Filtered visits', String(visits.length), 'Records matching current filters', '▤')}</section>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Filter visitor logs</h2><p class="subtle small">Daily records and monthly totals use the same selected filters.</p></div></div>
      <div class="report-filters"><label class="field"><span class="field-label">From date</span><input class="filter-control" type="date" id="report-from" value="${esc(reportFilters.from)}"></label><label class="field"><span class="field-label">To date</span><input class="filter-control" type="date" id="report-to" value="${esc(reportFilters.to)}"></label><label class="field"><span class="field-label">Officer</span><select class="filter-control" id="report-officer"><option value="">All officers</option>${state.officers.map((officer) => `<option value="${esc(officer.id)}" ${reportFilters.officer === officer.id ? 'selected' : ''}>${esc(officer.name)} · ${esc(officer.department)}</option>`).join('')}<option value="custom" ${reportFilters.officer === 'custom' ? 'selected' : ''}>Other office</option></select></label><label class="field"><span class="field-label">Purpose</span><select class="filter-control" id="report-purpose"><option value="">All purposes</option>${state.purposes.map((purpose) => `<option value="${esc(purpose)}" ${reportFilters.purpose === purpose ? 'selected' : ''}>${esc(purpose)}</option>`).join('')}</select></label></div>
      <div class="report-tabs" role="tablist" aria-label="Report period"><button class="report-tab${reportFilters.period === 'daily' ? ' active' : ''}" type="button" role="tab" aria-selected="${reportFilters.period === 'daily'}" data-action="report-period" data-period="daily">Daily log</button><button class="report-tab${reportFilters.period === 'monthly' ? ' active' : ''}" type="button" role="tab" aria-selected="${reportFilters.period === 'monthly'}" data-action="report-period" data-period="monthly">Monthly log</button></div>
      ${reportFilters.period === 'daily' ? `<div class="panel-header"><div><h3 class="panel-title">Visit records</h3><p class="subtle small">${visits.length} record${visits.length === 1 ? '' : 's'}</p></div></div>${renderDailyReport(visits)}` : `<div class="panel-header"><div><h3 class="panel-title">Monthly totals</h3><p class="subtle small">Visits grouped by month</p></div></div>${renderMonthlyReport(visits)}`}
    </section><section class="panel" style="margin-top:16px"><div class="panel-header"><div><h2 class="panel-title">Visits per day</h2><p class="subtle small">Last 14 days · filtered to selected officer and purpose</p></div></div>${renderReportChart(visits)}</section>`;
}
function renderAuditList(limit = Infinity) {
  const entries = [...state.audit].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  if (!entries.length) return `<div class="empty-state"><div class="empty-state-icon">◷</div><strong>No audit activity yet</strong><p>Sign-ins, check-ins, checkout, tag changes, and settings updates will appear here.</p></div>`;
  return `<div class="audit-list">${entries.map((entry) => `<div class="audit-item"><span class="audit-dot" aria-hidden="true"></span><div><strong>${esc(entry.action)} · ${esc(entry.actor || 'System')}</strong><p>${esc(entry.details || '')}</p></div><time datetime="${esc(entry.timestamp)}">${esc(formatDateTime(entry.timestamp))}</time></div>`).join('')}</div>`;
}
function renderSettings() {
  const departments = state.departments || [];
  return `${heading('Admin workspace', 'Settings & audit', 'Manage the seeded host list, visit purposes, tag capacity, and demo data.', '')}
    <div class="settings-grid">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Officers and departments</h2><p class="subtle small">Searchable hosts shown during check-in.</p></div><span class="status-pill blue">${state.officers.length} officers</span></div>
        <form id="officer-form" class="form-grid"><div class="field"><label for="officer-name">Officer name</label><input id="officer-name" name="name" required placeholder="Full name"></div><div class="field"><label for="officer-department">Department</label><select id="officer-department" name="department">${departments.map((department) => `<option>${esc(department)}</option>`).join('')}</select></div><div class="field full"><button class="btn btn-primary btn-small" type="submit">Add officer</button></div></form>
        <ul class="settings-list">${state.officers.map((officer) => `<li class="settings-row settings-edit-row"><input class="filter-control" aria-label="Officer name" value="${esc(officer.name)}" data-officer-name-edit="${esc(officer.id)}"><select class="filter-control" aria-label="Officer department" data-officer-department-edit="${esc(officer.id)}">${departments.map((department) => `<option value="${esc(department)}" ${department === officer.department ? 'selected' : ''}>${esc(department)}</option>`).join('')}</select><button class="btn btn-secondary btn-small" type="button" data-action="save-officer-edit" data-id="${esc(officer.id)}">Save</button><button class="btn btn-danger btn-small" type="button" data-action="remove-officer" data-id="${esc(officer.id)}">Remove</button></li>`).join('')}</ul>
        <form id="department-form" class="settings-add"><input class="filter-control" name="department" placeholder="Add a department" required><button class="btn btn-secondary btn-small" type="submit">Add department</button></form>
        <ul class="settings-list">${departments.map((department) => `<li class="settings-row settings-department-row"><div class="settings-department-edit"><input class="filter-control" aria-label="Department name" value="${esc(department)}" data-department-edit="${esc(department)}"><span>${state.officers.filter((officer) => officer.department === department).length} officer(s)</span></div><button class="btn btn-secondary btn-small" type="button" data-action="save-department-edit" data-department="${esc(department)}">Save</button><button class="btn btn-quiet btn-small" type="button" data-action="remove-department" data-department="${esc(department)}" ${state.officers.some((officer) => officer.department === department) ? 'disabled title="Remove or reassign officers first"' : ''}>Remove</button></li>`).join('')}</ul>
      </section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Purpose list</h2><p class="subtle small">Edit or remove check-in purpose labels.</p></div></div>
        <ul class="settings-list">${state.purposes.map((purpose, index) => `<li class="settings-row"><div style="flex:1"><input class="filter-control" aria-label="Purpose label" value="${esc(purpose)}" data-purpose-edit="${index}"></div><button class="btn btn-secondary btn-small" type="button" data-action="save-purpose" data-index="${index}">Save</button><button class="btn btn-danger btn-small" type="button" data-action="remove-purpose" data-index="${index}">Delete</button></li>`).join('')}</ul>
        <form id="purpose-form" class="settings-add"><input class="filter-control" name="purpose" placeholder="Add a purpose" required><button class="btn btn-secondary btn-small" type="submit">Add purpose</button></form>
      </section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Tag capacity</h2><p class="subtle small">Default demo setup includes 50 tags.</p></div><span class="status-pill green">${tagCounts().available} available</span></div>
        <form id="tag-count-form" class="settings-add"><input class="filter-control" type="number" name="tagCount" min="1" max="200" value="${esc(state.settings.tagCount)}" required><button class="btn btn-primary btn-small" type="submit">Save tag count</button></form><p class="subtle small" style="margin-top:10px">Tag count cannot be reduced below the highest number currently in use.</p>
      </section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Demo data</h2><p class="subtle small">Reload fictional sample records or reset any edits.</p></div></div><p class="subtle">Sample data includes 30 fictional Nigerian visitors and two weeks of visit history.</p><div class="heading-actions"><button class="btn btn-secondary btn-small" type="button" data-action="load-samples">Load sample data</button><button class="btn btn-danger btn-small" type="button" data-action="reset-demo">Reset demo data</button></div><p class="credentials-warning">These actions replace local demo records in this browser only. They do not affect other devices.</p></section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-header"><div><h2 class="panel-title">Audit log</h2><p class="subtle small">Visible to Admin · Who did what and when</p></div><span class="status-pill">${state.audit.length} event${state.audit.length === 1 ? '' : 's'}</span></div>${renderAuditList()}</section>`;
}
function renderModal() {
  if (!modal) return '';
  if (modal.type === 'assign') return renderAssignModal();
  if (modal.type === 'tag-details') return renderTagDetailsModal(modal.number);
  return '';
}
function renderAssignModal() {
  const counts = tagCounts();
  const available = Array.from({ length: counts.count }, (_, index) => index + 1).filter((number) => tagInfo(number).status === 'available');
  const visitor = draft.name || 'Visitor';
  const checkInTime = new Date();
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="assign-title"><div class="modal-header"><div><p class="eyebrow">Visitor check-in</p><h2 id="assign-title">${selectedTag ? 'Confirm tag assignment' : 'Assign an entry tag'}</h2><p class="subtle small">${selectedTag ? `Choose the moment to complete ${esc(visitor)}’s check-in.` : `${counts.available} tags available · ${counts.inUse} currently in use`}</p></div><button class="icon-button" type="button" aria-label="Close" data-action="close-modal">×</button></div>
    <div class="modal-body">${selectedTag ? `<div class="confirmation-box"><div class="confirmation-check">✓</div><div><strong>Tag ${esc(selectedTag)} is available for ${esc(visitor)}</strong><span>Proposed check-in time: ${esc(formatDateTime(checkInTime))}</span></div></div><div class="content-grid" style="margin-top:17px"><div class="panel"><p class="eyebrow">Visitor</p><h3>${esc(visitor)}</h3><p class="subtle">${esc(draft.phone)} · ${esc(draft.host || 'Host to be confirmed')}</p><p class="subtle">${esc(purposeLabel() || 'Purpose not specified')}</p></div><div class="panel"><p class="eyebrow">Assigned tag</p><div class="display-tag" style="margin-top:0"><span>Tag number</span><strong>${esc(selectedTag)}</strong></div></div></div>` : `<div class="tag-board-toolbar"><div class="tag-legend"><span><i class="legend-dot"></i>Available · click to select</span><span><i class="legend-dot red"></i>In use · unavailable</span><span><i class="legend-dot amber"></i>Lost/unavailable</span></div><button class="btn btn-secondary btn-small" type="button" data-action="suggest-tag" ${available.length ? '' : 'disabled'}>Suggest next free tag</button></div>${available.length ? `<div class="tag-grid">${Array.from({ length: counts.count }, (_, index) => index + 1).map((number) => { const info = tagInfo(number); const cls = info.status === 'in-use' ? 'in-use' : info.status === 'unavailable' ? 'unavailable' : 'available'; const label = info.status === 'in-use' ? info.visitor?.name || 'In use' : info.status === 'unavailable' ? 'Unavailable' : 'Available'; return `<button class="tag-tile ${cls}" type="button" data-action="select-tag" data-tag-number="${number}" ${info.status !== 'available' ? 'disabled' : ''} title="${esc(info.status === 'in-use' ? `In use by ${label}` : label)}"><strong>${number}</strong><span>${cls === 'available' ? 'Available' : esc(info.status === 'in-use' ? label.split(' ')[0] : 'Unavailable')}</span></button>`; }).join('')}</div>` : '<div class="empty-state"><div class="empty-state-icon">▦</div><strong>No tags are available</strong><p>Check out a visitor or restore an unavailable tag before assigning another.</p></div>'}`}</div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button>${selectedTag ? `<div class="heading-actions"><button class="btn btn-secondary" type="button" data-action="change-tag">Change tag</button><button class="btn btn-primary" type="button" data-action="complete-checkin">Complete check-in</button></div>` : '<span class="subtle small">Tags in use cannot be reassigned.</span>'}</div></section></div>`;
}
function renderTagDetailsModal(number) {
  const info = tagInfo(number);
  const visit = info.visit;
  const visitor = info.visitor;
  const adminAction = isAdmin() && info.status !== 'in-use' ? (info.status === 'unavailable' ? '<button class="btn btn-primary" type="button" data-action="restore-tag">Restore tag</button>' : '<button class="btn btn-danger" type="button" data-action="mark-tag-lost">Mark lost / unavailable</button>') : '';
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="tag-detail-title"><div class="modal-header"><div><p class="eyebrow">Entry tag</p><h2 id="tag-detail-title">Tag ${esc(number)} details</h2><p class="subtle small">${info.status === 'in-use' ? 'This tag is currently assigned.' : info.status === 'unavailable' ? 'This tag is marked lost or unavailable.' : 'This tag is available for a visitor.'}</p></div><button class="icon-button" type="button" aria-label="Close" data-action="close-modal">×</button></div><div class="modal-body">${info.status === 'in-use' ? `<div class="person-cell">${photoMarkup(visit.photo, visitor.name)}<div><strong>${esc(visitor.name)}</strong><span>${esc(visitor.phone)}</span></div></div><div class="settings-list"><div class="settings-row"><div><strong>Host</strong><span>${esc(visit.host || '—')} · ${esc(visit.department || '')}</span></div></div><div class="settings-row"><div><strong>Purpose</strong><span>${esc(visit.purpose)}${visit.purposeDetail ? `: ${esc(visit.purposeDetail)}` : ''}</span></div></div><div class="settings-row"><div><strong>Check-in</strong><span>${esc(formatDateTime(visit.checkIn))} · ${esc(formatDuration(visit.checkIn, null))}</span></div></div></div>` : `<div class="confirmation-box"><div class="confirmation-check">${info.status === 'available' ? '✓' : '!'}</div><div><strong>${info.status === 'available' ? 'Available' : 'Unavailable'}</strong><span>${esc(info.tag?.reason || (info.status === 'available' ? 'Ready to assign to a visitor.' : 'No reason recorded.'))}</span></div></div>`}</div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Close</button><div class="heading-actions">${visit ? `<button class="btn btn-danger" type="button" data-action="checkout" data-visit="${esc(visit.id)}">Check out visitor</button>` : adminAction}</div></div></section></div>`;
}
function render() {
  if (!app) return;
  app.innerHTML = renderApp();
  if (cameraActive) attachCamera();
}
function attachCamera() {
  const video = document.querySelector('#camera-video');
  if (video && cameraStream) {
    video.srcObject = cameraStream;
    video.play().catch(() => {});
  }
}
function stopCamera() {
  if (cameraStream) for (const track of cameraStream.getTracks()) track.stop();
  cameraStream = null;
  cameraActive = false;
}
async function startCamera() {
  cameraIssue = '';
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraIssue = 'This browser or page does not support camera access.';
    render();
    return;
  }
  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    cameraActive = true;
    render();
    attachCamera();
  } catch (error) {
    cameraActive = false;
    cameraStream = null;
    cameraIssue = error?.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'The camera could not be opened.';
    render();
  }
}
function capturePhoto() {
  const video = document.querySelector('#camera-video');
  if (!video || !video.videoWidth) { toast('Wait for the camera preview, then capture.', 'error'); return; }
  const scale = Math.min(1, 900 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) { toast('Photo capture is unavailable in this browser.', 'error'); return; }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  draft.photo = canvas.toDataURL('image/jpeg', 0.78);
  cameraIssue = '';
  formErrors = {};
  broadcastDraft();
  render();
}
async function uploadPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Choose an image file.', 'error'); return; }
  try {
    draft.photo = await compressImage(file, 900, 0.78);
    cameraIssue = '';
    formErrors = {};
    broadcastDraft();
    render();
    toast('Visitor photo is ready.');
  } catch (error) {
    toast(error?.message || 'Could not process this image.', 'error');
  }
}
function validateStepOne() {
  const errors = {};
  if (!draft.phone.trim()) errors.phone = 'Phone number is required.';
  else if (!isValidNigerianPhone(draft.phone)) errors.phone = 'Enter a valid Nigerian mobile number, e.g. 0803… or +234 803…';
  if (!draft.name.trim()) errors.name = 'Visitor name is required.';
  if (!draft.address.trim()) errors.address = 'Address is required.';
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = 'Enter a valid email address or leave this blank.';
  formErrors = errors;
  return Object.keys(errors).length === 0;
}
function collectGroupMembers() {
  document.querySelectorAll('[data-member-index]').forEach((input) => {
    const index = Number(input.dataset.memberIndex);
    if (!draft.groupMembers[index]) draft.groupMembers[index] = { name: '', phone: '' };
    draft.groupMembers[index][input.dataset.memberField] = input.value;
  });
}
function validateStepThree() {
  collectGroupMembers();
  const errors = {};
  if (!draft.host.trim()) errors.host = 'Select or enter an office/officer to visit.';
  if (!draft.purpose) errors.purpose = 'Choose a purpose of visit.';
  if (draft.purpose === 'Other' && !draft.purposeDetail.trim()) errors.purposeDetail = 'Specify the purpose of visit.';
  draft.groupMembers.forEach((member, index) => {
    const hasName = Boolean(member.name.trim());
    const hasPhone = Boolean(member.phone.trim());
    if (!hasName && !hasPhone) return;
    if (!hasName || !hasPhone) errors[`member-${index}`] = 'Enter both a name and phone number.';
    else if (!isValidNigerianPhone(member.phone)) errors[`member-${index}`] = 'Enter a valid Nigerian phone number.';
  });
  formErrors = errors;
  return Object.keys(errors).length === 0;
}
function availableTagSuggestion() {
  const counts = tagCounts();
  for (let number = 1; number <= counts.count; number += 1) if (tagInfo(number).status === 'available') return number;
  return null;
}
function openAssignTags() {
  modal = { type: 'assign' };
  selectedTag = null;
  render();
}
function completeCheckin() {
  if (!selectedTag) return;
  // Refresh browser storage immediately before committing to avoid assigning a tag already claimed in another tab.
  state = getState();
  const info = tagInfo(selectedTag);
  if (info.status !== 'available') {
    modal = { type: 'assign' };
    selectedTag = null;
    render();
    toast('That tag is no longer available. Choose another free tag.', 'error');
    return;
  }
  const now = new Date().toISOString();
  let visitor = state.visitors.find((item) => normalizePhone(item.phone) === normalizePhone(draft.phone));
  if (visitor) {
    visitor.name = draft.name.trim();
    visitor.phone = draft.phone.trim();
    visitor.address = draft.address.trim();
    visitor.email = draft.email.trim();
  } else {
    visitor = { id: createId('visitor'), name: draft.name.trim(), phone: draft.phone.trim(), address: draft.address.trim(), email: draft.email.trim() };
    state.visitors.unshift(visitor);
  }
  const host = hostSelection();
  const purposeOther = draft.purpose === 'Other' ? draft.purposeDetail.trim() : '';
  const visit = {
    id: createId('visit'), visitorId: visitor.id, photo: safePhoto(draft.photo),
    hostId: host.hostId, host: host.host, department: host.department,
    purpose: draft.purpose, purposeDetail: purposeOther,
    groupMembers: draft.groupMembers.filter((member) => member.name.trim() && member.phone.trim()).map((member) => ({ name: member.name.trim(), phone: member.phone.trim() })),
    appointment: draft.appointment === 'Yes', appointmentReference: draft.appointment === 'Yes' ? draft.appointmentReference.trim() : '',
    tagNumber: Number(selectedTag), checkIn: now, checkOut: null,
  };
  state.visits.unshift(visit);
  const tag = state.tags.find((item) => Number(item.number) === Number(selectedTag));
  if (tag && tag.reason === 'Issued to an active visit') { tag.status = 'available'; tag.reason = ''; }
  addAudit(state, session.name, 'Visitor checked in', `${visitor.name} · Tag ${selectedTag} · ${host.host}`);
  state = saveState(state);
  const tagNumber = selectedTag;
  successVisitId = visit.id;
  selectedTag = null;
  modal = null;
  currentStep = 1;
  stopCamera();
  broadcastDraft('checked-in', tagNumber);
  render();
  toast(`${visitor.name} checked in · Tag ${tagNumber}`);
}
function checkoutVisit(visitId) {
  state = getState();
  const visit = state.visits.find((item) => item.id === visitId && !item.checkOut);
  if (!visit) { modal = null; render(); toast('This visit has already been checked out.', 'error'); return; }
  visit.checkOut = new Date().toISOString();
  const tag = state.tags.find((item) => Number(item.number) === Number(visit.tagNumber));
  if (tag?.reason === 'Issued to an active visit') { tag.status = 'available'; tag.reason = ''; }
  const visitor = state.visitors.find((item) => item.id === visit.visitorId);
  addAudit(state, session?.name || 'Reception', 'Visitor checked out', `${visitor?.name || 'Visitor'} · Tag ${visit.tagNumber} · ${formatDateTime(visit.checkOut)}`);
  state = saveState(state);
  modal = null;
  if (currentView === 'inside') render();
  else render();
  toast(`Tag ${visit.tagNumber} is available again.`);
}
function markTagUnavailable(number) {
  if (!isAdmin()) return;
  state = getState();
  const info = tagInfo(number);
  if (info.status === 'in-use') { toast('A tag in use cannot be marked unavailable.', 'error'); return; }
  let tag = state.tags.find((item) => Number(item.number) === Number(number));
  if (!tag) { tag = { number: Number(number), status: 'available', reason: '' }; state.tags.push(tag); }
  tag.status = 'unavailable';
  tag.reason = 'Lost / unavailable';
  addAudit(state, session.name, 'Tag marked unavailable', `Tag ${number}`);
  state = saveState(state);
  modal = null;
  render();
  toast(`Tag ${number} marked unavailable.`);
}
function restoreTag(number) {
  if (!isAdmin()) return;
  state = getState();
  const info = tagInfo(number);
  if (info.status === 'in-use') { toast('A tag in use cannot be restored.', 'error'); return; }
  let tag = state.tags.find((item) => Number(item.number) === Number(number));
  if (!tag) { tag = { number: Number(number), status: 'available', reason: '' }; state.tags.push(tag); }
  tag.status = 'available'; tag.reason = '';
  addAudit(state, session.name, 'Tag restored', `Tag ${number}`);
  state = saveState(state);
  modal = null;
  render();
  toast(`Tag ${number} is available.`);
}
function openCustomerDisplay() {
  const url = new URL('./display/', window.location.href);
  window.open(url.href, 'ncs-visitor-customer-display', 'noopener,noreferrer');
}
function syncInsideTable() {
  const table = document.querySelector('#inside-table-container');
  if (table) table.innerHTML = renderInsideTable(filterActive());
  const header = document.querySelector('.panel-header .subtle.small');
  if (header && currentView === 'inside') header.textContent = `${tagCounts().available} available / ${tagCounts().inUse} in use`;
}
function updateTagCount(value) {
  if (!isAdmin()) { toast('Admin access is required to change tag capacity.', 'error'); return false; }
  const nextCount = Math.max(1, Math.min(200, Number(value) || 50));
  const maxActiveTag = Math.max(0, ...activeVisits().map((visit) => Number(visit.tagNumber) || 0));
  if (nextCount < maxActiveTag) { toast(`Tag count cannot be reduced below tag ${maxActiveTag}, which is in use.`, 'error'); return false; }
  const oldTags = new Map(state.tags.map((tag) => [Number(tag.number), tag]));
  state.tags = Array.from({ length: nextCount }, (_, index) => oldTags.get(index + 1) || { number: index + 1, status: 'available', reason: '' });
  state.settings.tagCount = nextCount;
  addAudit(state, session.name, 'Updated tag capacity', `Set tag count to ${nextCount}`);
  state = saveState(state);
  toast(`Tag capacity updated to ${nextCount}.`);
  return true;
}
function safeDownloadReport() {
  if (!isAdmin()) { toast('Admin access is required to export reports.', 'error'); return; }
  const visits = filteredReportVisits();
  const rows = [['Visitor', 'Phone', 'Address', 'Host', 'Department', 'Purpose', 'Purpose detail', 'Additional visitors', 'Appointment', 'Appointment reference', 'Tag', 'Check-in', 'Check-out', 'Duration']];
  for (const visit of visits) {
    const visitor = visitorFor(visit);
    rows.push([visitor.name, visitor.phone, visitor.address, visit.host, visit.department, visit.purpose, visit.purposeDetail || '', (visit.groupMembers || []).map((member) => `${member.name} (${member.phone})`).join('; '), visit.appointment ? 'Yes' : 'No', visit.appointmentReference || '', visit.tagNumber, visit.checkIn, visit.checkOut || '', visit.checkOut ? formatDuration(visit.checkIn, visit.checkOut) : 'Still inside']);
  }
  const ok = downloadCsv(`visitor-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  if (!ok) toast('CSV export could not be started in this browser.', 'error');
  else toast(`${visits.length} visit record${visits.length === 1 ? '' : 's'} exported.`);
}
function saveOfficer(name, department) {
  if (!isAdmin()) { toast('Admin access is required to manage officers.', 'error'); return false; }
  const officerName = name.trim(); const dept = department.trim();
  if (!officerName || !dept) return false;
  if (state.officers.some((officer) => officer.name.toLowerCase() === officerName.toLowerCase())) { toast('That officer is already listed.', 'error'); return false; }
  if (!state.departments.includes(dept)) state.departments.push(dept);
  state.officers.push({ id: createId('officer'), name: officerName, department: dept });
  addAudit(state, session.name, 'Added officer', `${officerName} · ${dept}`);
  state = saveState(state); render(); toast(`${officerName} added to the host list.`); return true;
}
function editOfficer(id, name, department) {
  if (!isAdmin()) { toast('Admin access is required to manage officers.', 'error'); return; }
  const officer = state.officers.find((item) => item.id === id);
  if (!officer) return;
  const nextName = name.trim(); const nextDepartment = department.trim();
  if (!nextName || !nextDepartment) { toast('Enter an officer name and department.', 'error'); return; }
  if (state.officers.some((item) => item.id !== id && item.name.toLowerCase() === nextName.toLowerCase())) { toast('That officer is already listed.', 'error'); return; }
  if (!state.departments.includes(nextDepartment)) state.departments.push(nextDepartment);
  const previous = `${officer.name} · ${officer.department}`;
  officer.name = nextName; officer.department = nextDepartment;
  addAudit(state, session.name, 'Edited officer', `${previous} → ${nextName} · ${nextDepartment}`);
  state = saveState(state); render(); toast(`${nextName} updated.`);
}
function addDepartment(name) {
  if (!isAdmin()) { toast('Admin access is required to manage departments.', 'error'); return; }
  const department = name.trim();
  if (!department) return;
  if (state.departments.some((item) => item.toLowerCase() === department.toLowerCase())) { toast('That department already exists.', 'error'); return; }
  state.departments.push(department);
  addAudit(state, session.name, 'Added department', department);
  state = saveState(state); render(); toast(`${department} added.`);
}
function editDepartment(previousName, nextName) {
  if (!isAdmin()) { toast('Admin access is required to manage departments.', 'error'); return; }
  const previous = previousName.trim(); const next = nextName.trim();
  const index = state.departments.findIndex((item) => item === previous);
  if (index < 0 || !next) { toast('Enter a department name.', 'error'); return; }
  if (state.departments.some((item, itemIndex) => itemIndex !== index && item.toLowerCase() === next.toLowerCase())) { toast('That department already exists.', 'error'); return; }
  state.departments[index] = next;
  for (const officer of state.officers) if (officer.department === previous) officer.department = next;
  addAudit(state, session.name, 'Edited department', `${previous} → ${next}`);
  state = saveState(state); render(); toast(`${next} updated.`);
}
function removeDepartment(department) {
  if (!isAdmin()) { toast('Admin access is required to manage departments.', 'error'); return; }
  if (state.officers.some((officer) => officer.department === department)) { toast('Reassign or remove officers before removing this department.', 'error'); return; }
  state.departments = state.departments.filter((item) => item !== department);
  addAudit(state, session.name, 'Removed department', department);
  state = saveState(state); render(); toast(`${department} removed.`);
}
function removeOfficer(id) {
  if (!isAdmin()) { toast('Admin access is required to manage officers.', 'error'); return; }
  const officer = state.officers.find((item) => item.id === id);
  if (!officer) return;
  state.officers = state.officers.filter((item) => item.id !== id);
  addAudit(state, session.name, 'Removed officer', `${officer.name} · Historical visit records are retained`);
  state = saveState(state); render(); toast(`${officer.name} removed from the host list.`);
}
function addPurpose(value) {
  if (!isAdmin()) { toast('Admin access is required to manage purposes.', 'error'); return; }
  const purpose = value.trim();
  if (!purpose) return;
  if (state.purposes.some((item) => item.toLowerCase() === purpose.toLowerCase())) { toast('That purpose already exists.', 'error'); return; }
  state.purposes.push(purpose);
  addAudit(state, session.name, 'Added visit purpose', purpose);
  state = saveState(state); render(); toast('Purpose added.');
}
function editPurpose(index, value) {
  if (!isAdmin()) { toast('Admin access is required to manage purposes.', 'error'); return; }
  const next = value.trim();
  if (!next || !state.purposes[index]) { toast('Enter a purpose label.', 'error'); return; }
  const previous = state.purposes[index];
  if (state.purposes.some((item, i) => i !== index && item.toLowerCase() === next.toLowerCase())) { toast('That purpose already exists.', 'error'); return; }
  state.purposes[index] = next;
  addAudit(state, session.name, 'Edited visit purpose', `${previous} → ${next}`);
  state = saveState(state); render(); toast('Purpose updated.');
}
function removePurpose(index) {
  if (!isAdmin()) { toast('Admin access is required to manage purposes.', 'error'); return; }
  const purpose = state.purposes[index];
  if (!purpose) return;
  state.purposes.splice(index, 1);
  addAudit(state, session.name, 'Removed visit purpose', `${purpose} · Historical visits are retained`);
  state = saveState(state); render(); toast('Purpose removed from the list.');
}
function reloadSampleData(reset = false) {
  if (!isAdmin()) { toast('Admin access is required to manage demo data.', 'error'); return; }
  const verb = reset ? 'Reset demo data' : 'Loaded sample data';
  state = reset ? resetDemoData() : loadSampleData();
  addAudit(state, session.name, verb, 'Restored the fictional sample visitor records and visits');
  state = saveState(state);
  modal = null;
  successVisitId = '';
  draft = blankDraft();
  render();
  toast('Fictional sample data is ready.');
}
function collectStepOne() {
  for (const field of ['phone', 'name', 'address', 'email']) {
    const input = document.querySelector(`[data-draft="${field}"]`);
    if (input) draft[field] = input.value;
  }
}
function collectStepThree() {
  for (const field of ['host', 'purpose', 'purposeDetail', 'appointment', 'appointmentReference']) {
    const input = document.querySelector(`[data-draft="${field}"]`);
    if (input) draft[field] = input.value;
  }
  collectGroupMembers();
}
function focusFirstError() {
  const first = document.querySelector('.field.invalid input, .field.invalid select, [data-member-index]');
  first?.focus();
}
function handleLoginSubmit(form) {
  const data = new FormData(form);
  const role = String(data.get('role') || 'Receptionist');
  const account = DEMO_ACCOUNTS[role];
  if (account && String(data.get('email') || '').trim().toLowerCase() === account.email.toLowerCase() && String(data.get('password') || '') === account.password) loginAs(role);
  else { loginError = 'Those details do not match the demo account for this role. Use one of the credentials shown below.'; render(); }
}

app?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.id === 'login-form') { handleLoginSubmit(form); return; }
  if (form.id === 'step-one-form') {
    collectStepOne();
    if (!validateStepOne()) { render(); focusFirstError(); return; }
    formErrors = {}; currentStep = 2; broadcastDraft(); render(); return;
  }
  if (form.id === 'step-two-form') {
    if (!draft.photo) { formErrors = { general: 'Capture or upload a visitor photo before continuing.' }; render(); return; }
    formErrors = {}; stopCamera(); currentStep = 3; broadcastDraft(); render(); return;
  }
  if (form.id === 'step-three-form') {
    collectStepThree();
    if (!validateStepThree()) { render(); focusFirstError(); return; }
    formErrors = {}; stopCamera(); broadcastDraft(); openAssignTags(); return;
  }
  if (form.id === 'officer-form') {
    const data = new FormData(form); if (saveOfficer(String(data.get('name') || ''), String(data.get('department') || ''))) form.reset(); return;
  }
  if (form.id === 'department-form') { const data = new FormData(form); addDepartment(String(data.get('department') || '')); return; }
  if (form.id === 'purpose-form') { const data = new FormData(form); addPurpose(String(data.get('purpose') || '')); return; }
  if (form.id === 'tag-count-form') { const data = new FormData(form); if (updateTagCount(data.get('tagCount'))) render(); return; }
});

app?.addEventListener('input', (event) => {
  const target = event.target;
  if (target.matches('[data-draft]')) setDraftField(target.dataset.draft, target.value);
  if (target.matches('[data-member-index]')) {
    const index = Number(target.dataset.memberIndex);
    if (!draft.groupMembers[index]) draft.groupMembers[index] = { name: '', phone: '' };
    draft.groupMembers[index][target.dataset.memberField] = target.value;
  }
  if (target.id === 'inside-search') { insideQuery = target.value; syncInsideTable(); }
});

app?.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.matches('[data-draft]')) {
    setDraftField(target.dataset.draft, target.value);
    if (target.dataset.draft === 'purpose') {
      const other = document.querySelector('#other-purpose-wrap'); if (other) other.hidden = target.value !== 'Other';
    }
    if (target.dataset.draft === 'appointment') {
      const reference = document.querySelector('#appointment-reference-wrap'); if (reference) reference.hidden = target.value !== 'Yes';
    }
  }
  if (target.id === 'photo-upload') await uploadPhoto(target.files?.[0]);
  if (target.id === 'inside-purpose-filter') { insidePurpose = target.value; syncInsideTable(); }
  if (target.id.startsWith('report-') && !isAdmin()) { toast('Admin access is required to view reports.', 'error'); return; }
  if (target.id === 'report-from') { reportFilters.from = target.value; render(); }
  if (target.id === 'report-to') { reportFilters.to = target.value; render(); }
  if (target.id === 'report-officer') { reportFilters.officer = target.value; render(); }
  if (target.id === 'report-purpose') { reportFilters.purpose = target.value; render(); }
});

app?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    if (event.target.classList.contains('modal-backdrop')) { modal = null; selectedTag = null; render(); }
    return;
  }
  const action = button.dataset.action;
  if (action === 'quick-login') { loginAs(button.dataset.role); return; }
  if (action === 'logout') { logout(); return; }
  if (action === 'navigate') { modal = null; currentView = button.dataset.view; successVisitId = ''; render(); return; }
  if (action === 'open-display') { openCustomerDisplay(); return; }
  if (action === 'start-checkin') { startNewCheckin(); return; }
  if (action === 'wizard-back') { if (currentStep > 1) { if (currentStep === 3) stopCamera(); currentStep -= 1; formErrors = {}; render(); } return; }
  if (action === 'start-camera') { await startCamera(); return; }
  if (action === 'capture-photo') { capturePhoto(); return; }
  if (action === 'retake-photo') { draft.photo = ''; cameraIssue = ''; formErrors = {}; broadcastDraft(); render(); if (!cameraStream) await startCamera(); else attachCamera(); return; }
  if (action === 'add-group-member') { collectStepThree(); draft.groupMembers.push({ name: '', phone: '' }); render(); return; }
  if (action === 'remove-group-member') { collectStepThree(); draft.groupMembers.splice(Number(button.dataset.index), 1); render(); return; }
  if (action === 'assign-tags') { openAssignTags(); return; }
  if (action === 'close-modal') { modal = null; selectedTag = null; render(); return; }
  if (action === 'select-tag') {
    const number = Number(button.dataset.tagNumber);
    if (tagInfo(number).status !== 'available') { toast('That tag is not available.', 'error'); return; }
    selectedTag = number; render(); return;
  }
  if (action === 'suggest-tag') { const number = availableTagSuggestion(); if (number) { selectedTag = number; render(); } else toast('No free tag is available.', 'error'); return; }
  if (action === 'change-tag') { selectedTag = null; render(); return; }
  if (action === 'complete-checkin') { completeCheckin(); return; }
  if (action === 'checkout') { checkoutVisit(button.dataset.visit); return; }
  if (action === 'tag-details') { modal = { type: 'tag-details', number: Number(button.dataset.tagNumber) }; render(); return; }
  if (action === 'mark-tag-lost') { markTagUnavailable(modal?.number); return; }
  if (action === 'restore-tag') { restoreTag(modal?.number); return; }
  if (action === 'report-period') { if (!isAdmin()) { toast('Admin access is required to view reports.', 'error'); return; } reportFilters.period = button.dataset.period; render(); return; }
  if (action === 'export-report') { safeDownloadReport(); return; }
  if (action === 'print-report') { if (isAdmin()) window.print(); else toast('Admin access is required to print reports.', 'error'); return; }
  if (action === 'save-officer-edit') {
    const id = button.dataset.id;
    const nameInput = Array.from(document.querySelectorAll('[data-officer-name-edit]')).find((input) => input.dataset.officerNameEdit === id);
    const departmentInput = Array.from(document.querySelectorAll('[data-officer-department-edit]')).find((input) => input.dataset.officerDepartmentEdit === id);
    if (nameInput && departmentInput) editOfficer(id, nameInput.value, departmentInput.value);
    return;
  }
  if (action === 'save-department-edit') {
    const previous = button.dataset.department;
    const input = Array.from(document.querySelectorAll('[data-department-edit]')).find((field) => field.dataset.departmentEdit === previous);
    if (input) editDepartment(previous, input.value);
    return;
  }
  if (action === 'remove-officer') { removeOfficer(button.dataset.id); return; }
  if (action === 'remove-department') { removeDepartment(button.dataset.department); return; }
  if (action === 'save-purpose') { const input = document.querySelector(`[data-purpose-edit="${button.dataset.index}"]`); editPurpose(Number(button.dataset.index), input?.value || ''); return; }
  if (action === 'remove-purpose') { removePurpose(Number(button.dataset.index)); return; }
  if (action === 'load-samples') { if (window.confirm('Replace the current local demo records with fictional sample data?')) reloadSampleData(false); return; }
  if (action === 'reset-demo') { if (window.confirm('Reset this browser’s demo records to the original sample dataset?')) reloadSampleData(true); return; }
});

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    state = getState();
    if (session) render();
  }
});

try {
  if ('BroadcastChannel' in window) {
    broadcast = new BroadcastChannel(DISPLAY_CHANNEL);
  }
} catch (_) { broadcast = null; }

try {
  if (!globalThis.localStorage?.getItem(DISPLAY_STORAGE_KEY)) broadcastIdle();
} catch (_) {
  broadcastIdle();
}
render();
