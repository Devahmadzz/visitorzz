/* Browser-only demo data and persistence for the NCS Visitor Desk. */
export const STORAGE_KEY = 'ncs-visitor-desk-state-v1';

const VERSION = 1;
const PURPOSES = [
  'Official', 'Meeting', 'Personal', 'Delivery', 'Enquiry', 'Interview',
  'Contractor/Maintenance', 'Other',
];
const DEPARTMENTS = [
  'Administration', 'Human Resources', 'ICT', 'Finance', 'Operations',
  'Enforcement', 'Public Relations', 'Procurement',
];
const OFFICERS = [
  { id: 'officer-01', name: 'Amina Bello', department: 'Administration' },
  { id: 'officer-02', name: 'Chinedu Okafor', department: 'Human Resources' },
  { id: 'officer-03', name: 'Ibrahim Musa', department: 'ICT' },
  { id: 'officer-04', name: 'Ngozi Eze', department: 'Finance' },
  { id: 'officer-05', name: 'Tunde Adeyemi', department: 'Operations' },
  { id: 'officer-06', name: 'Fatima Sani', department: 'Enforcement' },
  { id: 'officer-07', name: 'Emeka Nwosu', department: 'Public Relations' },
  { id: 'officer-08', name: 'Zainab Ibrahim', department: 'Procurement' },
];

// About 30 plausible but entirely fictional visitors, with visits across the last 14 days.
const SAMPLE_VISITORS = [
  ['Adaeze Nwankwo', '08031204561', 'Brightline Logistics'],
  ['Yusuf Abdullahi', '08064519832', 'Northstar Supplies'],
  ['Tomiwa Akinola', '08123456789', 'Akinola & Partners'],
  ['Maryam Garba', '09031247856', 'Arewa Consulting'],
  ['Chukwudi Eze', '07045678912', 'Independent'],
  ['Bisi Ogunleye', '08167893450', 'Lagos State University'],
  ['Sani Danjuma', '09087651234', 'Danjuma Electricals'],
  ['Kelechi Obasi', '08099887766', 'Metro Courier'],
  ['Halima Lawal', '09123456780', 'Cedar Health Services'],
  ['Femi Balogun', '07012349876', 'Balogun Engineering'],
  ['Ngozi Onwudiwe', '08055667788', 'Independent'],
  ['Abubakar Shehu', '08105551234', 'Unity Bank'],
  ['Yetunde Alabi', '09011122334', 'Alabi Legal Chambers'],
  ['Ifeanyi Umeh', '08033445566', 'Umeh Building Works'],
  ['Rahmat Bello', '08144556677', 'Daily Beacon'],
  ['Oluwaseun Adebayo', '07055661234', 'Adebayo Foods'],
  ['Esther Okon', '09024446688', 'Federal University of Technology'],
  ['Musa Bako', '08077889900', 'Bako Maintenance'],
  ['Nkiru Ibe', '08199887766', 'Crest Recruitment'],
  ['Segun Afolayan', '09035557799', 'Afolayan Ventures'],
  ['Safiya Umar', '08022334455', 'Independent'],
  ['Tochukwu Anene', '07066778899', 'Swift Parcel'],
  ['Ladi Abubakar', '08111222333', 'Greenfield Energy'],
  ['Morenike Fashola', '09046668800', 'Fashola & Co.'],
  ['David Ojo', '08088990011', 'Ojo Network Services'],
  ['Aisha Mohammed', '08133445566', 'Kano Textiles'],
  ['Olumide Hassan', '09057779911', 'Hassan Advisory'],
  ['Chiamaka Nwosu', '07077889900', 'Independent'],
  ['Babatunde Ajayi', '08011223344', 'Ajayi Construction'],
  ['Zara Usman', '08155667788', 'Bluecrest Medical'],
];

// [visitor index, days ago, hour, minute, duration minutes, officer index, purpose, tag, active]
const SAMPLE_VISITS = [
  [0, 13, 9, 10, 52, 0, 'Meeting', 12], [1, 13, 11, 25, 37, 4, 'Delivery', 7],
  [2, 12, 10, 5, 86, 2, 'Official', 21], [3, 12, 13, 40, 44, 1, 'Interview', 3],
  [4, 11, 8, 55, 31, 5, 'Enquiry', 16], [5, 11, 14, 15, 68, 6, 'Official', 9],
  [6, 10, 9, 35, 73, 3, 'Contractor/Maintenance', 24], [7, 10, 12, 5, 28, 4, 'Delivery', 11],
  [8, 9, 10, 20, 56, 7, 'Meeting', 18], [9, 9, 15, 0, 92, 2, 'Contractor/Maintenance', 5],
  [10, 8, 9, 45, 25, 0, 'Personal', 30], [11, 8, 11, 10, 61, 3, 'Official', 14],
  [12, 7, 10, 0, 47, 1, 'Meeting', 2], [13, 7, 13, 25, 78, 5, 'Contractor/Maintenance', 26],
  [14, 6, 9, 15, 39, 6, 'Enquiry', 19], [15, 6, 14, 5, 54, 4, 'Delivery', 8],
  [16, 5, 10, 30, 88, 7, 'Interview', 33], [17, 5, 12, 40, 33, 2, 'Contractor/Maintenance', 10],
  [18, 4, 9, 0, 65, 1, 'Interview', 27], [19, 4, 15, 20, 42, 0, 'Official', 6],
  [20, 3, 10, 15, 29, 5, 'Personal', 20], [21, 3, 13, 10, 49, 4, 'Delivery', 15],
  [22, 2, 9, 50, 83, 3, 'Meeting', 35], [23, 2, 11, 35, 36, 6, 'Enquiry', 22],
  [24, 1, 9, 20, 58, 2, 'Contractor/Maintenance', 4], [25, 1, 14, 0, 71, 7, 'Official', 31],
  [26, 0, 8, 45, 45, 1, 'Meeting', 48, true], [27, 0, 9, 30, 35, 4, 'Delivery', 49, true],
  [28, 0, 10, 5, 60, 5, 'Contractor/Maintenance', 50, true], [29, 0, 11, 15, 40, 6, 'Enquiry', 13],
];

let memoryState = null;

/** Create an ID with a cryptographic UUID when available and a safe fallback otherwise. */
export function createId(prefix = 'id') {
  let suffix;
  try {
    suffix = globalThis.crypto?.randomUUID?.();
  } catch (_) {
    // Some restricted browser contexts expose crypto but block its methods.
  }
  if (!suffix) suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  return `${String(prefix || 'id')}-${suffix}`;
}

function getStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
  } catch (_) {
    return null;
  }
}

function normalizeState(input) {
  const source = input && typeof input === 'object' ? input : {};
  const asArray = (value) => Array.isArray(value) ? value : [];
  const tags = asArray(source.tags).map((tag, index) => {
    const item = tag && typeof tag === 'object' ? tag : {};
    const status = item.status === 'unavailable' ? 'unavailable' : 'available';
    return {
      number: item.number ?? index + 1,
      status,
      reason: typeof item.reason === 'string' ? item.reason : '',
    };
  });
  const settings = source.settings && typeof source.settings === 'object' ? source.settings : {};
  return {
    version: VERSION,
    visitors: asArray(source.visitors),
    visits: asArray(source.visits),
    tags,
    officers: asArray(source.officers),
    departments: asArray(source.departments),
    purposes: asArray(source.purposes),
    settings: { ...settings, tagCount: Number.isFinite(Number(settings.tagCount)) ? Number(settings.tagCount) : 50 },
    audit: asArray(source.audit),
  };
}

function buildSampleState() {
  const now = new Date();
  const visitors = SAMPLE_VISITORS.map(([name, phone, organization], index) => ({
    id: `visitor-${String(index + 1).padStart(2, '0')}`,
    name,
    phone,
    organization,
    address: `${12 + index} ${['Unity Road', 'Independence Way', 'Secretariat Road', 'Market Street', 'Herbert Macaulay Way'][index % 5]}, ${['Abuja FCT', 'Lagos, Lagos State', 'Kano, Kano State', 'Port Harcourt, Rivers State'][index % 4]}`,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
  }));
  const activeTags = new Set(SAMPLE_VISITS.filter((visit) => visit[8]).map((visit) => visit[7]));
  const tags = Array.from({ length: 50 }, (_, index) => {
    const number = index + 1;
    const unavailable = activeTags.has(number);
    return { number, status: unavailable ? 'unavailable' : 'available', reason: unavailable ? 'Issued to an active visit' : '' };
  });
  const visits = SAMPLE_VISITS.map((record, index) => {
    const [visitorIndex, daysAgo, hour, minute, duration, officerIndex, purpose, tagNumber, active = false] = record;
    const checkInDate = new Date(now);
    checkInDate.setDate(checkInDate.getDate() - daysAgo);
    checkInDate.setHours(hour, minute, 0, 0);
    // Keep active visits in progress even when the demo is opened earlier in the day.
    if (active && daysAgo === 0) checkInDate.setTime(now.getTime() - duration * 60_000);
    const officer = OFFICERS[officerIndex];
    const checkOutDate = new Date(checkInDate.getTime() + duration * 60_000);
    return {
      id: `visit-${String(index + 1).padStart(2, '0')}`,
      visitorId: visitors[visitorIndex].id,
      photo: '',
      hostId: officer.id,
      host: officer.name,
      department: officer.department,
      purpose,
      groupMembers: [],
      appointment: index % 3 === 0,
      appointmentReference: index % 3 === 0 ? `NCS-${String(6200 + index)}` : '',
      tagNumber,
      checkIn: checkInDate.toISOString(),
      checkOut: active ? null : checkOutDate.toISOString(),
    };
  });
  return {
    version: VERSION,
    visitors,
    visits,
    tags,
    officers: OFFICERS.map((officer) => ({ ...officer })),
    departments: [...DEPARTMENTS],
    purposes: [...PURPOSES],
    settings: { tagCount: 50 },
    audit: [],
  };
}

/** Load a valid saved state, or seed demo data on first load/corrupt storage. */
export function getState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === VERSION && typeof parsed === 'object') {
          memoryState = normalizeState(parsed);
          return memoryState;
        }
      }
    } catch (_) {
      // Blocked, corrupt, or unavailable storage should not prevent app use.
    }
  }
  if (memoryState?.version === VERSION) return memoryState;
  return saveState(buildSampleState());
}

/** Persist a normalized state when possible; always return it for memory-only use. */
export function saveState(state) {
  const normalized = normalizeState(state);
  memoryState = normalized;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (_) {
      // Quota/security failures leave this session functional via memoryState.
    }
  }
  return normalized;
}

/** Replace current app data with a fresh copy of the demo seed. */
export function resetDemoData() {
  return saveState(buildSampleState());
}

/** Reload the same sample dataset, replacing any edits currently in the app. */
export function loadSampleData() {
  return resetDemoData();
}

/** Append a timestamped audit event and return the supplied state for convenience. */
export function addAudit(state, actor, action, details = '') {
  const target = state && typeof state === 'object' ? state : getState();
  if (!Array.isArray(target.audit)) target.audit = [];
  target.audit.push({
    id: createId('audit'),
    timestamp: new Date().toISOString(),
    actor: String(actor ?? ''),
    action: String(action ?? ''),
    details: details == null ? '' : (typeof details === 'string' ? details : JSON.stringify(details)),
  });
  return target;
}
