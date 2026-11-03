/* Small, dependency-free helpers shared by the static visitor desk UI. */

/** Convert common Nigerian phone spellings to an 11-digit local match key. */
export function normalizePhone(phone) {
  if (phone == null) return '';
  let digits = String(phone).trim().replace(/[\s().-]/g, '').replace(/\+/g, '');
  if (!/^\d+$/.test(digits)) return '';
  if (digits.startsWith('00234') && digits.length === 15) digits = digits.slice(2);
  if (digits.startsWith('234') && digits.length === 13) digits = `0${digits.slice(3)}`;
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  return '';
}

/** Validate the usual 11-digit Nigerian mobile-number format. */
export function isValidNigerianPhone(phone) {
  const local = normalizePhone(phone);
  return Boolean(local && /^(070|080|081|090|091)\d{8}$/.test(local));
}

function asDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a date/time in the browser's local timezone; invalid values render as an em dash. */
export function formatDateTime(value) {
  const date = asDate(value);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  } catch (_) {
    return date.toLocaleString();
  }
}

/** Format a time of day in the browser's local timezone. */
export function formatTime(value) {
  const date = asDate(value);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit' }).format(date);
  } catch (_) {
    return date.toLocaleTimeString();
  }
}

/** Render elapsed time as compact days/hours/minutes, clamping reversed ranges to zero. */
export function formatDuration(start, endOrNow = new Date()) {
  const beginning = asDate(start);
  const ending = endOrNow === null || endOrNow === undefined || endOrNow === ''
    ? new Date()
    : asDate(endOrNow);
  if (!beginning || !ending) return '—';
  let minutes = Math.floor(Math.max(0, ending.getTime() - beginning.getTime()) / 60_000);
  const days = Math.floor(minutes / 1440);
  minutes %= 1440;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (remainder || parts.length === 0) parts.push(`${remainder}m`);
  return parts.join(' ');
}

/** Escape one value as an RFC 4180-style CSV cell. */
export function csvEscape(value) {
  let text;
  if (value === null || value === undefined) text = '';
  else if (typeof value === 'object') {
    try { text = JSON.stringify(value); } catch (_) { text = String(value); }
  } else text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Download rows (array-of-arrays) as UTF-8 CSV; returns false if browser APIs are unavailable. */
export function downloadCsv(filename, rows) {
  try {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || !Array.isArray(rows)) return false;
    const csv = rows.map((row) => (Array.isArray(row) ? row : [row]).map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const urlApi = globalThis.URL;
    if (!urlApi?.createObjectURL) return false;
    const url = urlApi.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = String(filename || 'visitors.csv').replace(/[\\/:*?"<>|]/g, '_');
    link.style.display = 'none';
    (document.body || document.documentElement).appendChild(link);
    link.click();
    link.remove();
    // Delay revocation to allow the browser to begin the download.
    globalThis.setTimeout?.(() => urlApi.revokeObjectURL(url), 1000);
    return true;
  } catch (_) {
    return false;
  }
}

/** Resize and encode an image file/data URL as JPEG. Rejects invalid/unreadable image inputs. */
export function compressImage(fileOrDataUrl, maxDimension = 900, quality = 0.78) {
  return new Promise((resolve, reject) => {
    let objectUrl = '';
    const cleanup = () => {
      if (objectUrl) {
        try { globalThis.URL?.revokeObjectURL?.(objectUrl); } catch (_) { /* best effort */ }
        objectUrl = '';
      }
    };
    try {
      if (typeof Image === 'undefined') throw new Error('Image processing is not supported in this browser.');
      let source;
      if (typeof fileOrDataUrl === 'string') {
        if (!/^data:image\//i.test(fileOrDataUrl)) throw new Error('Expected an image data URL or file.');
        source = fileOrDataUrl;
      } else if (fileOrDataUrl && typeof fileOrDataUrl === 'object') {
        if (typeof globalThis.URL?.createObjectURL !== 'function') throw new Error('File URL support is unavailable.');
        objectUrl = globalThis.URL.createObjectURL(fileOrDataUrl);
        source = objectUrl;
      } else {
        throw new Error('Expected an image data URL or file.');
      }

      const image = new Image();
      image.onload = () => {
        try {
          const width = image.naturalWidth || image.width;
          const height = image.naturalHeight || image.height;
          if (!width || !height) throw new Error('Image has no dimensions.');
          const limitValue = Number(maxDimension);
          const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 900;
          const scale = Math.min(1, limit / Math.max(width, height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas is unavailable.');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const qValue = Number(quality);
          const q = Number.isFinite(qValue) ? Math.min(1, Math.max(0, qValue)) : 0.78;
          const result = canvas.toDataURL('image/jpeg', q);
          cleanup();
          resolve(result);
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error('Could not encode image.'));
        }
      };
      image.onerror = () => {
        cleanup();
        reject(new Error('Could not read image.'));
      };
      image.src = source;
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('Could not process image.'));
    }
  });
}

/** Escape text before inserting it into HTML markup. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
