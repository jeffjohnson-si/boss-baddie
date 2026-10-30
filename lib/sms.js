import crypto from 'node:crypto';

/**
 * SMS — sending one text message, through whichever provider is configured.
 * (server only: reads env and makes a network request)
 *
 * WHY AN ABSTRACTION AND NOT "call Twilio here": the number format, the sender ID
 * and the provider available for Solomon Islands numbers are all decisions that
 * may change, and none of them should be spread through the routes. There are two
 * transports:
 *
 *   console  (default, for development) — prints the message to the server log and
 *            reports success. Nothing is sent and nothing costs money. This is the
 *            ONLY mode in which a code may be shown in the API response, and even
 *            then only with SMS_DEV_SHOW_CODE=1.
 *
 *   twilio   — POSTs to the Twilio Messages API. Needs
 *            TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM.
 *
 * Adding another provider (a local aggregator, for instance) means one more branch
 * in sendSms() and nothing else.
 */

/** Six-digit local numbers are Solomon Islands mobiles; everything else is passed through. */
export function toE164(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 7 ? `+677${digits}` : `+${digits}`;
}

export function smsProvider() {
  return String(process.env.SMS_PROVIDER || 'console').toLowerCase();
}

/** The Twilio sender: a Messaging Service (preferred) or a single From number. */
function twilioSender() {
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    return { sort: 'MessagingServiceSid', value: process.env.TWILIO_MESSAGING_SERVICE_SID };
  }
  if (process.env.TWILIO_FROM) return { sort: 'From', value: process.env.TWILIO_FROM };
  return null;
}

/** Can this process send a text at all? Checked before a code is generated. */
export function isSmsConfigured() {
  const provider = smsProvider();

  if (provider === 'console') return true;

  if (provider === 'twilio') {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && twilioSender(),
    );
  }

  return false;
}

/**
 * Turn Twilio's numeric errors into something an operator can act on. The full
 * message is logged either way; this only makes the obvious fixes findable.
 */
const TWILIO_HINTS = {
  20003: 'Authenticate failed — check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
  21211: 'The To number is not a valid E.164 number.',
  21606: 'That From number is not SMS-capable.',
  21608: 'Trial account: the destination number must be verified in Twilio first.',
  21610: 'The recipient replied STOP; they must opt back in.',
  21612: 'Twilio cannot route to this number from that sender.',
  21408: 'SMS to this country is not enabled on the account.',
};

/**
 * Send one message.
 * @returns {Promise<{ok:boolean, id?:string, error?:string, code?:number, hint?:string}>}
 */
export async function sendSms(to, body) {
  const provider = smsProvider();

  if (provider === 'console') {
    // Visible in the server log, which is the point: a developer can complete a
    // sign-up with no account anywhere and no phone in hand.
    console.log(`[sms:console] to ${to} — ${body}`);
    return { ok: true, id: 'console' };
  }

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const sender = twilioSender();

    if (!sid || !token || !sender) {
      return { ok: false, error: 'Twilio is not configured.' };
    }

    const params = new URLSearchParams({ To: to, Body: body });
    params.set(sender.sort, sender.value);

    // Ten seconds. A hanging request must not hold a sign-up open forever; the
    // caller deletes the pending row and asks her to try again.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          signal: controller.signal,
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const code = Number(data?.code) || null;
        const message = data?.message || `Provider returned ${response.status}.`;
        const hint = code ? TWILIO_HINTS[code] : undefined;

        console.error(
          `[sms] Twilio rejected the message (${response.status}${code ? `, code ${code}` : ''}): ${message}` +
            (hint ? ` — ${hint}` : ''),
        );

        return { ok: false, error: message, code: code ?? undefined, hint };
      }

      return { ok: true, id: data?.sid ?? 'twilio' };
    } catch (error) {
      const aborted = error?.name === 'AbortError';
      console.error(`[sms] Twilio request ${aborted ? 'timed out' : 'failed'}:`, error);
      return {
        ok: false,
        error: aborted ? 'The provider did not answer in time.' : 'The message could not be sent.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, error: `Unknown SMS provider "${provider}".` };
}

/** The verification message. One place, so the wording cannot drift. */
export function verificationMessage(code) {
  return `BOSS BADDIE: your verification code is ${code}. It expires in 10 minutes. If you did not ask for this, ignore this message.`;
}

/**
 * Generate nothing here — the code is made and stored by lib/verification.js — this
 * only formats and sends.
 */
export async function sendVerificationSms(phone, code) {
  return sendSms(toE164(phone), verificationMessage(code));
}

/** A random id, used when a caller wants to correlate a send with its log line. */
export function smsReference() {
  return crypto.randomBytes(6).toString('hex');
}
