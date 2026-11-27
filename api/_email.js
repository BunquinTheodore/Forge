import { FORMS } from '../shared/registration.js';

/**
 * Emails the ICCPI team about each saved registration, through Resend (https://resend.com).
 * The leading underscore stops Vercel publishing this file as its own endpoint.
 * Environment (Vercel project settings):
 *   RESEND_API_KEY           needed to send. Without it registrations still save and a warning is logged.
 *   REGISTRATION_EMAIL_TO    optional, comma separated. Default: f.calabretta@iccpi.org.ph
 *   REGISTRATION_EMAIL_FROM  optional. The default, onboarding@resend.dev, needs no DNS records but only
 *                            delivers to the address that owns the Resend account. To use any other sender
 *                            or recipient, verify that sender's domain in Resend first.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_TO = 'f.calabretta@iccpi.org.ph';
const DEFAULT_FROM = 'FORGE PH 2027 <onboarding@resend.dev>';
export const EMAIL_TIMEOUT_MS = 8000;

// Stricter than the form's own check, because Resend refuses the whole email if reply_to is malformed.
// No leading, trailing or doubled dots, and domain labels cannot start or end with a hyphen.
const REPLY_TO = /^[A-Za-z0-9_%+'-]+(?:\.[A-Za-z0-9_%+'-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
const LINE_BREAK = /\r\n|[\r\n\x85\p{Zl}\p{Zp}]/u;
const INDENT = '    ';

const oneLine = (value) => String(value).replace(/[\s\x85]+/g, ' ').trim();

/** One answer as "Label: value", or an empty string when the visitor left it blank. */
function answer(field, value) {
  if (field.type === 'consent') return `Consent given: ${value ? 'Yes' : 'No'}`;
  const text = Array.isArray(value) ? value.join(', ') : value;
  if (!text) return '';
  if (field.type !== 'textarea') return `${field.label}: ${oneLine(text)}`;
  // Free text is indented line by line, so it can never pass for one of the labelled lines.
  const heading = field.label.endsWith('?') ? field.label : `${field.label}:`;
  return [heading, ...text.split(LINE_BREAK).map((line) => `${INDENT}${line}`)].join('\n');
}

function buildEmail(formKey, reference, values) {
  const { title, received, fields } = FORMS[formKey];
  const to = (process.env.REGISTRATION_EMAIL_TO || DEFAULT_TO).split(',').map((a) => a.trim()).filter(Boolean);
  return {
    from: process.env.REGISTRATION_EMAIL_FROM || DEFAULT_FROM,
    to,
    ...(REPLY_TO.test(values.email) && { reply_to: values.email }),
    subject: `FORGE PH 2027: new ${title} ${received} from ${oneLine(values.fullName)} (${reference})`,
    text: [
      `New ${title} ${received} for FORGE PH 2027`,
      `Reference: ${reference}`,
      '',
      ...fields.map((field) => answer(field, values[field.name])).filter(Boolean),
      '',
      // Worded to stay true on a retry, so a resent form produces the same email and Resend sends it once.
      'The record is in the ICCPI Google Sheet. If a form was edited and sent again, the sheet keeps the first version.',
    ].join('\n'),
  };
}

/** Never throws: the registration is already saved, so an email problem must not become an error for the visitor. */
export async function emailTeam(formKey, reference, values) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[register] RESEND_API_KEY is not set, no email sent for', reference);
    return;
  }
  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'User-Agent': 'forge-ph-website/1.0',
        // A retried submission keeps its reference, so Resend sends it only once (keys last 24 hours).
        'Idempotency-Key': `forge-registration/${reference}`,
      },
      body: JSON.stringify(buildEmail(formKey, reference, values)),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
    if (response.ok) return;
    // Only the error name is logged: Resend's message can repeat addresses.
    const reply = await response.json().catch(() => null);
    console.error('[register] email not sent', reference, response.status, reply?.name || '');
  } catch (err) {
    console.error('[register] email failed', reference, err.name);
  }
}
