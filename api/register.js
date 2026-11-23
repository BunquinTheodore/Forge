import { randomBytes } from 'node:crypto';
import { validate } from '../shared/registration.js';

/**
 * POST /api/register
 * Validates a FORGE PH 2027 registration and hands it to the ICCPI Google Sheet webhook.
 * Environment (Vercel project settings):
 *   REGISTRATION_WEBHOOK_URL     Google Apps Script web app URL (see docs/registration-setup.md)
 *   REGISTRATION_WEBHOOK_SECRET  shared secret the Apps Script checks before writing a row
 *   ALLOWED_ORIGINS              optional, comma separated extra origins (https://example.org)
 */

const MAX_BODY_CHARS = 20000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 6;
const WEBHOOK_TIMEOUT_MS = 25000;
const PRODUCTION_HOSTS = ['forgeph.org', 'www.forgeph.org'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

const hits = new Map(); // ip -> timestamps. Best effort: each serverless instance keeps its own window.

const originHost = (value) => {
  try { return new URL(value).host.replace(/:\d+$/, ''); } catch { return ''; }
};

/**
 * Browser-level protection only (a script can forge Origin), so it is not treated as authentication.
 * Production accepts the real domains. Staging accepts this deployment's own preview host; local development accepts localhost.
 * Preview hosts other than the current deployment (for example an alias) can be added through ALLOWED_ORIGINS.
 */
function originAllowed(req) {
  const source = req.headers.origin || req.headers.referer || '';
  if (!source) return false;
  const host = originHost(source);
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => originHost(o.trim())).filter(Boolean);
  if (PRODUCTION_HOSTS.includes(host) || extra.includes(host)) return true;
  if (process.env.VERCEL_ENV === 'production') return false;
  // Staging: this project's own preview hosts only, and local development.
  const own = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean);
  return LOCAL_HOSTS.includes(host) || own.includes(host);
}

function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) { hits.set(ip, recent); return true; } // blocked attempts do not extend the window
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const PHONE_LIKE = /^\+?[\d\s().-]+$/;

/** Spreadsheet formulas start with = + - @ : neutralise them before they reach the sheet (phone numbers are left alone). */
const neutralise = (v) => (typeof v === 'string' && /^[=+\-@]/.test(v) && !PHONE_LIKE.test(v) ? `'${v}` : v);

const SUBMISSION_ID = /^[a-f0-9-]{8,64}$/i;

/** The browser makes one id per form visit and reuses it on retry, so a retry after a timeout never creates a second row. */
function referenceFor(submissionId) {
  const fromClient = typeof submissionId === 'string' && SUBMISSION_ID.test(submissionId) ? submissionId.replace(/-/g, '').slice(0, 8) : '';
  return `FORGE-${(fromClient || randomBytes(4).toString('hex')).toUpperCase()}`;
}

function toRecord(formKey, values, submissionId) {
  const record = { form: formKey, reference: referenceFor(submissionId), submittedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(values)) {
    record[key] = Array.isArray(value) ? value.map(neutralise).join('; ') : neutralise(value);
  }
  return record;
}

async function forward(record) {
  const url = process.env.REGISTRATION_WEBHOOK_URL;
  const secret = process.env.REGISTRATION_WEBHOOK_SECRET;
  if (!url || !secret) return { status: 503, body: { ok: false, code: 'not_configured' } };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, record }),
      redirect: 'follow',
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    const reply = await response.json().catch(() => null);
    if (!response.ok || !reply?.ok) {
      console.error('[register] webhook rejected', record.form, response.status, reply?.error || '');
      return { status: 502, body: { ok: false, code: 'upstream' } };
    }
    return { status: 200, body: { ok: true, reference: record.reference } };
  } catch (err) {
    console.error('[register] webhook failed', record.form, err.name);
    return { status: 502, body: { ok: false, code: 'upstream' } };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'method' });
  }
  if (!originAllowed(req)) return res.status(403).json({ ok: false, code: 'origin' });
  if (rateLimited(req)) return res.status(429).json({ ok: false, code: 'rate' });

  const body = req.body;
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > MAX_BODY_CHARS) {
    return res.status(400).json({ ok: false, code: 'body' });
  }
  // Honeypot: real visitors never fill the hidden field. Pretend success so bots learn nothing.
  if (typeof body.hp === 'string' && body.hp.trim() !== '') {
    return res.status(200).json({ ok: true, reference: `FORGE-${randomBytes(4).toString('hex').toUpperCase()}` });
  }

  const result = validate(body.form, body.values);
  if (!result.ok) return res.status(422).json({ ok: false, code: 'invalid', errors: result.errors });

  const { status, body: reply } = await forward(toRecord(body.form, result.values, body.submissionId));
  return res.status(status).json(reply);
}
