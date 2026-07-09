const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_API_URL = 'https://api.brevo.com/v3';
const FROM_EMAIL = process.env.FROM_EMAIL || 'support@fennark.xyz';
const FROM_NAME = process.env.FROM_NAME || 'DEV/CRAFT';

export function isConfigured() {
  return Boolean(BREVO_API_KEY);
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getPreferenceUrl(email) {
  return `https://www.fennark.xyz/api/email/unsubscribe?email=${encodeURIComponent(email)}`;
}

function getMailtoUnsubscribe(email) {
  return `mailto:support@fennark.xyz?subject=Unsubscribe&body=Please%20unsubscribe%20${encodeURIComponent(email)}`;
}

export async function sendEmail({ to, subject, html, type, category, unsubscribeUrl }) {
  if (!BREVO_API_KEY) {
    console.warn('[Brevo] API key not configured. Email not sent.');
    return { success: false, error: 'Brevo API key not configured' };
  }

  if (!to || !subject || !html) {
    return { success: false, error: 'Missing required fields: to, subject, html' };
  }

  const emails = Array.isArray(to) ? to : [to];
  const emailAddr = typeof emails[0] === 'string' ? emails[0] : emails[0].email;
  const prefUrl = unsubscribeUrl || getPreferenceUrl(emailAddr);
  const mailtoUnsub = getMailtoUnsubscribe(emailAddr);
  const plainText = stripHtml(html);

  const payload = {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: emails.map(e => typeof e === 'string' ? { email: e } : e),
    subject,
    htmlContent: html,
    textContent: plainText,
    headers: {
      'X-Category': category || type || 'general',
      'X-Email-Type': type || 'general',
      'List-Unsubscribe': `<${mailtoUnsub}>, <${prefUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    params: { UNSUBSCRIBE_URL: prefUrl },
    tag: type || 'general',
  };

  try {
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Brevo] Send failed:', response.status, data);
      return { success: false, error: data.message || `HTTP ${response.status}`, details: data };
    }

    console.log(`[Brevo] Email sent to ${emails.map(e => typeof e === 'string' ? e : e.email).join(', ')} — ${subject} (messageId: ${data.messageId})`);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('[Brevo] Network error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function sendTransactionalEmail({ to, templateId, params }) {
  if (!BREVO_API_KEY) {
    console.warn('[Brevo] API key not configured.');
    return { success: false, error: 'Not configured' };
  }

  const payload = {
    to: (Array.isArray(to) ? to : [to]).map(e => typeof e === 'string' ? { email: e } : e),
    templateId,
    params: params || {},
  };

  try {
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return response.ok
      ? { success: true, messageId: data.messageId }
      : { success: false, error: data.message || `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createContact({ email, name, listIds }) {
  if (!BREVO_API_KEY) return { success: false, error: 'Not configured' };
  try {
    const response = await fetch(`${BREVO_API_URL}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: name || '' },
        listIds: listIds || [],
        updateEnabled: true,
      }),
    });
    const data = await response.json();
    return response.ok || response.status === 201
      ? { success: true, id: data.id }
      : { success: false, error: data.message };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
