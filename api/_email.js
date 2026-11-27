import { FORMS } from '../shared/registration.js';
import { CONTACTS, EVENT, confirmationHtml } from './_confirmationHtml.js';

/**
 * The two emails sent for each saved registration, through Resend (https://resend.com):
 * the full answers to the ICCPI team, and a confirmation to the person who registered.
 * The leading underscore stops Vercel publishing this file as its own endpoint.
 * Environment (Vercel project settings):
 *   RESEND_API_KEY           needed to send. Without it registrations still save and a warning is logged.
 *   REGISTRATION_EMAIL_TO    optional, comma separated team recipients. Default: f.calabretta@iccpi.org.ph
 *   REGISTRATION_EMAIL_FROM  optional sender, on a domain verified in Resend. Default: registrations@forgeph.org
 */

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_TO = 'f.calabretta@iccpi.org.ph';
const DEFAULT_FROM = 'FORGE PH 2027 <registrations@forgeph.org>';
export const EMAIL_TIMEOUT_MS = 8000;

// One plain address, stricter than the form's own check: nothing that could be read as a second recipient or that
// Resend would refuse. No leading, trailing or doubled dots, and domain labels cannot start or end with a hyphen.
const ADDRESS = /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
// A short word that looks like a first name: up to 20 characters with at most one hyphen or apostrophe. A dot is
// allowed only at the end (Ma.), so it can never be a web address.
const FIRST_NAME = /^(?=.{1,20}\.?$)[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)?\.?$/u;
const RECEIVED = { conference: 'conference registration', booth: 'booth application', workshop: 'workshop and FD90 interest' };
const LINE_BREAK = /\r\n|[\r\n\x85\p{Zl}\p{Zp}]/u;
const INDENT = '    ';

const oneLine = (value) => String(value).replace(/[\s\x85]+/g, ' ').trim();
const sender = () => process.env.REGISTRATION_EMAIL_FROM || DEFAULT_FROM;

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

function teamEmail(formKey, reference, values) {
  const { title, received, fields } = FORMS[formKey];
  const to = (process.env.REGISTRATION_EMAIL_TO || DEFAULT_TO).split(',').map((a) => a.trim()).filter(Boolean);
  return {
    from: sender(),
    to,
    ...(ADDRESS.test(values.email) && { reply_to: values.email }),
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

/**
 * Goes to whatever address was typed into a public form, so the only typed text it can carry is one short first
 * name. That keeps links and messages out of an email sent to somebody who never asked for it.
 */
function confirmationEmail(formKey, reference, values) {
  const what = RECEIVED[formKey];
  const first = oneLine(values.fullName).split(' ')[0];
  const greeting = FIRST_NAME.test(first) ? `Hello ${first},` : 'Hello,';
  return {
    from: sender(),
    to: [values.email],
    reply_to: CONTACTS[0],
    subject: `FORGE PH 2027: we received your ${what} (${reference})`,
    html: confirmationHtml({ greeting, what, reference }),
    text: [
      greeting,
      '',
      `Thank you. We have received your ${what} for FORGE PH 2027.`,
      `Your reference: ${reference}`,
      '',
      `When: ${EVENT.date}, ${EVENT.time}`,
      `Where: ${EVENT.venue}`,
      '',
      `The ICCPI team will write to you with the next steps. If you have a question, reply to this email or write to ${CONTACTS.join(' or ')}.`,
      '',
      'FORGE PH 2027, presented by the Italian Chamber of Commerce in the Philippines',
      'https://www.forgeph.org',
    ].join('\n'),
  };
}

/** Sends one email. Never throws, and logs no personal data: only the kind, the reference and the error name. */
async function send(kind, reference, key, message) {
  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'User-Agent': 'forge-ph-website/1.0',
        // A retried submission keeps its reference, so Resend sends each email only once (keys last 24 hours).
        'Idempotency-Key': `forge-${kind}/${reference}`,
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
    if (response.ok) return;
    // Resend's message can repeat addresses, so only its error name is logged.
    const reply = await response.json().catch(() => null);
    console.error(`[register] ${kind} email not sent`, reference, response.status, reply?.name || '');
  } catch (err) {
    console.error(`[register] ${kind} email failed`, reference, err.name);
  }
}

/** Never throws: the registration is already saved, so an email problem must not become an error for the visitor. */
export async function sendRegistrationEmails(formKey, reference, values) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[register] RESEND_API_KEY is not set, no email sent for', reference);
    return;
  }
  const jobs = [send('registration', reference, key, teamEmail(formKey, reference, values))];
  if (ADDRESS.test(values.email)) jobs.push(send('confirmation', reference, key, confirmationEmail(formKey, reference, values)));
  else console.warn('[register] no confirmation sent, unusual email address, for', reference);
  await Promise.all(jobs);
}
