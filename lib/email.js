/**
 * EMAIL TRANSPORT  (server only)
 * ==============================
 * Password-reset links and recovery-email confirmations are the only mail this
 * app sends. Two providers:
 *
 *   console  development: prints the message and the link to the server log
 *   brevo    production: Brevo's transactional API, no SDK needed
 *
 * Brevo's free plan allows 300 emails/day. The sender address (EMAIL_FROM) must
 * be verified in the Brevo dashboard before it will deliver.
 *
 * Sending never throws: a failed email must not turn a password-reset request
 * into a 500 that tells an attacker the address exists. Callers log the failure
 * and always answer the same way.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export function emailProvider() {
  return String(process.env.EMAIL_PROVIDER || 'console').toLowerCase();
}

export function isEmailConfigured() {
  const provider = emailProvider();
  if (provider === 'console') return true;
  if (provider === 'brevo') {
    return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
  }
  return false;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send one message.
 *
 * @param {{ to: string|string[], subject: string, text: string, html?: string }} message
 * @returns {Promise<{ ok: true, provider: string } | { ok: false, error: string }>}
 */
export async function sendEmail({ to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { ok: false, error: 'No recipients.' };
  }

  const provider = emailProvider();

  if (provider === 'console') {
    console.log(
      `\n[email:console] to: ${recipients.join(', ')}\n` +
        `subject: ${subject}\n\n${text}\n[email:console end]\n`,
    );
    return { ok: true, provider: 'console' };
  }

  if (provider === 'brevo') {
    const apiKey = process.env.BREVO_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.error('[email] EMAIL_PROVIDER=brevo but BREVO_API_KEY or EMAIL_FROM is missing.');
      return { ok: false, error: 'Email is not configured.' };
    }

    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: process.env.EMAIL_FROM_NAME || 'BOSS BADDIE',
            email: from,
          },
          to: recipients.map((email) => ({ email })),
          subject,
          htmlContent: html || `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
          textContent: text,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(`[email] Brevo ${response.status}: ${detail.slice(0, 300)}`);
        return { ok: false, error: 'The email provider refused the message.' };
      }

      return { ok: true, provider: 'brevo' };
    } catch (err) {
      console.error('[email] Brevo request failed:', err.message);
      return { ok: false, error: 'Could not reach the email provider.' };
    }
  }

  console.error(`[email] Unknown EMAIL_PROVIDER "${provider}".`);
  return { ok: false, error: 'Email is not configured.' };
}
