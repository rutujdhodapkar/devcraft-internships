import { rtdbGet, rtdbSet, rtdbDelete } from './db.js';
import { now } from './utils.js';

export async function saveCustomTemplate(templateName, data) {
  const tpl = {
    name: templateName,
    subject: data.subject || '',
    html: data.html || '',
    category: data.category || 'custom',
    sendOnce: data.sendOnce || false,
    intervalDays: data.intervalDays || 0,
    requiresApproval: data.requiresApproval !== false,
    updatedAt: now(),
    createdAt: now(),
  };
  await rtdbSet(`email_templates/${templateName}`, tpl);
  return tpl;
}

export async function getCustomTemplate(templateName) {
  const tpl = await rtdbGet(`email_templates/${templateName}`);
  return tpl || null;
}

export async function getAllTemplates() {
  const templates = await rtdbGet('email_templates') || {};
  return Object.entries(templates).map(([name, tpl]) => ({ name, ...tpl }));
}

export async function deleteTemplate(templateName) {
  await rtdbDelete(`email_templates/${templateName}`);
}

export async function duplicateTemplate(sourceName, newName) {
  const source = await getCustomTemplate(sourceName);
  if (!source) return null;
  const dup = { ...source, name: newName, createdAt: now(), updatedAt: now() };
  delete dup._id;
  await rtdbSet(`email_templates/${newName}`, dup);
  return dup;
}
