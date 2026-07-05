import { CONFIG } from './config.js';

export function isConfigured() {
  return Boolean(CONFIG.brevo.apiKey);
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

export async function sendEmail({ to, subject, html, templateName, category, notificationId }) {
  if (!isConfigured()) {
    console.warn('[EmailProvider] API key not configured');
    return { success: false, error: 'API key not configured' };
  }

  if (!to || !subject || !html) {
    return { success: false, error: 'Missing required fields' };
  }

  const emails = Array.isArray(to) ? to : [to];
  const email = typeof emails[0] === 'string' ? emails[0] : emails[0].email;
  const prefUrl = `${CONFIG.domain}/api/email/unsubscribe?email=${encodeURIComponent(email)}`;
  const plainText = stripHtml(html);

  const payload = {
    sender: { name: CONFIG.brevo.fromName, email: CONFIG.brevo.fromEmail },
    to: emails.map(e => (typeof e === 'string' ? { email: e } : e)),
    subject,
    htmlContent: html,
    textContent: plainText,
    headers: {
      'X-Notification-ID': notificationId || '',
      'X-Category': category || templateName || 'general',
      'List-Unsubscribe': `<mailto:${CONFIG.brevo.fromEmail}?subject=Unsubscribe>, <${prefUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    params: { UNSUBSCRIBE_URL: prefUrl },
    tag: templateName || category || 'general',
  };

  try {
    const response = await fetch(`${CONFIG.brevo.apiUrl}/smtp/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': CONFIG.brevo.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[EmailProvider] Send failed: ${response.status}`, data);
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
        statusCode: response.status,
        providerResponse: data,
      };
    }

    console.log(`[EmailProvider] Sent to ${email} — ${subject} (${data.messageId})`);
    return { success: true, messageId: data.messageId, providerResponse: data };
  } catch (err) {
    console.error(`[EmailProvider] Network error:`, err.message);
    return { success: false, error: err.message };
  }
}
