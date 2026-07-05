export function now() {
  return new Date().toISOString();
}

export function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function daysUntil(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  return Math.max(0, Math.floor((d.getTime() - Date.now()) / 86400000));
}

export function addDays(dateStr, days) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isBefore(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function dedupKey(applicationId, eventType, template, email) {
  return `${applicationId}_${eventType}_${template}_${email}`.toLowerCase();
}

export function sanitizePath(path) {
  return path.replace(/[.#$\[\]\/]/g, '_');
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
