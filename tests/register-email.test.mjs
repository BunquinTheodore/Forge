import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';
import handler from '../api/register.js';

// Every saved registration from the three forms is emailed to ICCPI through Resend.
// Only the network is faked: the handler, its validation and the email text are the real code.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const SHEET_URL = 'https://sheet.test/exec';
const RESEND_URL = 'https://api.resend.com/emails';
const TEAM = 'f.calabretta@iccpi.org.ph';

const contact = {
  fullName: 'Jane Cruz',
  email: 'jane@example.com',
  phone: '+63 917 000 0000',
  jobTitle: 'Founder',
  organization: 'Acme Labs',
  country: 'Philippines',
  businessCategory: 'Startup or founder',
  sector: 'Technology and software',
  notes: '',
  consent: true,
};
const FORM_CASES = [
  {
    form: 'conference',
    kind: 'Conference pass registration',
    values: { ...contact, participants: '2', otherAttendees: 'Juan Dela Cruz', interests: ['Conference and programme'] },
    lines: ['Number of participants: 2', 'Juan Dela Cruz', 'Interest in FORGE activities: Conference and programme'],
  },
  {
    form: 'booth',
    kind: 'Exhibition booth application',
    values: { ...contact, boothPackage: 'PHP 35,000', boothDescription: 'Our sensors', interests: ['Exhibiting'] },
    lines: ['Booth package: PHP 35,000', 'Our sensors', 'Interest in FORGE activities: Exhibiting'],
  },
  {
    form: 'workshop',
    kind: 'Workshop and FD90 interest',
    values: { ...contact, participateAs: 'Startup or venture', stage: 'Growth', summary: 'We build tools', interests: ['FD90 90-day development', 'FORGE NEXT'] },
    lines: ['Venture stage: Growth', 'We build tools', 'Interest in FORGE activities: FD90 90-day development, FORGE NEXT'],
  },
];

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
let visitor = 0;

/** Sets the environment, fakes the network and collects logs. Everything is restored after the test. */
function setup(t, { env = {}, sheet = () => json({ ok: true }), resend = () => json({ id: 'email_1' }) } = {}) {
  const wanted = {
    REGISTRATION_WEBHOOK_URL: SHEET_URL,
    REGISTRATION_WEBHOOK_SECRET: 'sheet-secret',
    RESEND_API_KEY: 're_test_key',
    REGISTRATION_EMAIL_TO: undefined,
    REGISTRATION_EMAIL_FROM: undefined,
    VERCEL_ENV: undefined,
    ...env,
  };
  const apply = (vars) => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
  const before = Object.fromEntries(Object.keys(wanted).map((key) => [key, process.env[key]]));
  apply(wanted);
  t.after(() => apply(before));

  const calls = [];
  const logs = [];
  for (const level of ['error', 'warn', 'log', 'info']) t.mock.method(console, level, (...parts) => logs.push(format(...parts)));
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, signal: init.signal, body: JSON.parse(init.body) });
    if (String(url) === SHEET_URL) return sheet();
    if (String(url) === RESEND_URL) return resend();
    throw new Error(`unexpected request to ${url}`);
  });
  return { calls, logs, emails: () => calls.filter((c) => c.url === RESEND_URL) };
}

async function submit(body) {
  visitor += 1; // a new address each time, so the per visitor limit never interferes
  const req = { method: 'POST', headers: { origin: 'https://www.forgeph.org', 'x-forwarded-for': `10.1.0.${visitor}` }, socket: {}, body };
  const res = {
    statusCode: 0,
    body: null,
    setHeader() {},
    status(code) { res.statusCode = code; return res; },
    json(value) { res.body = value; return res; },
  };
  await handler(req, res);
  return res;
}

const booking = (values = {}, extra = {}) => ({
  form: 'conference',
  submissionId: '1a2b3c4d-0000-4000-8000-000000000000',
  values: { ...FORM_CASES[0].values, ...values },
  ...extra,
});

for (const { form, kind, values, lines } of FORM_CASES) {
  test(`a ${form} registration is emailed to ICCPI`, async (t) => {
    const net = setup(t);
    const res = await submit({ form, submissionId: 'abcdef12-0000-4000-8000-000000000000', values });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(net.calls.map((c) => c.url), [SHEET_URL, RESEND_URL], 'saved first, then emailed');
    const [email] = net.emails();
    assert.deepEqual(email.body.to, [TEAM]);
    assert.equal(email.body.from, 'FORGE PH 2027 <onboarding@resend.dev>');
    assert.equal(email.body.reply_to, 'jane@example.com');
    assert.equal(email.body.subject, `FORGE PH 2027: new ${kind} from Jane Cruz (FORGE-ABCDEF12)`);
    for (const line of ['Reference: FORGE-ABCDEF12', 'Full name: Jane Cruz', 'Email: jane@example.com', 'Mobile number: +63 917 000 0000', 'Organization: Acme Labs', 'Consent given: Yes', ...lines]) {
      assert.ok(email.body.text.includes(line), `email text is missing "${line}"`);
    }
    assert.equal(email.headers.Authorization, 'Bearer re_test_key');
    assert.equal(email.headers['Idempotency-Key'], 'forge-registration/FORGE-ABCDEF12');
    assert.ok(email.headers['User-Agent'], 'Resend rejects requests without a User-Agent');
    assert.ok(email.signal instanceof AbortSignal, 'a slow email service must not hang the form');
  });
}

test('empty optional answers are left out of the email', async (t) => {
  const net = setup(t);
  await submit(booking({ notes: '', otherAttendees: '' }));
  assert.doesNotMatch(net.emails()[0].body.text, /Anything else|Names of the other participants/);
});

test('the recipients and sender can be changed in the environment', async (t) => {
  const net = setup(t, { env: { REGISTRATION_EMAIL_TO: 'one@example.org, two@example.org', REGISTRATION_EMAIL_FROM: 'FORGE <mail@send.example.org>' } });
  await submit(booking());
  assert.deepEqual(net.emails()[0].body.to, ['one@example.org', 'two@example.org']);
  assert.equal(net.emails()[0].body.from, 'FORGE <mail@send.example.org>');
});

test('a retry of the same submission sends an identical request, so Resend drops the duplicate', async (t) => {
  const net = setup(t);
  await submit(booking());
  await submit(booking());
  const [first, second] = net.emails();
  assert.equal(first.headers['Idempotency-Key'], second.headers['Idempotency-Key']);
  assert.deepEqual(first.body, second.body);
});

test('nothing is emailed when the sheet does not accept the registration', async (t) => {
  const net = setup(t, { sheet: () => json({ ok: false, error: 'forbidden' }) });
  const res = await submit(booking());
  assert.equal(res.statusCode, 502);
  assert.equal(net.emails().length, 0);
  assert.match(net.logs.join('\n'), /FORGE-1A2B3C4D/, 'the log should name the registration');
});

test('a sheet that does not answer is logged with the reference', async (t) => {
  const net = setup(t, { sheet: () => { throw new DOMException('timed out', 'TimeoutError'); } });
  const res = await submit(booking());
  assert.equal(res.statusCode, 502);
  assert.match(net.logs.join('\n'), /FORGE-1A2B3C4D/);
});

test('the email says which version the sheet keeps when a form is sent again', async (t) => {
  const net = setup(t, { sheet: () => json({ ok: true, duplicate: true }) });
  await submit(booking({ participants: '3' }));
  const { text } = net.emails()[0].body;
  assert.match(text, /sheet keeps the first version/);
  assert.doesNotMatch(text, /is also saved/);
});

test('spam and invalid submissions are never emailed', async (t) => {
  const net = setup(t);
  await submit(booking({}, { hp: 'i am a bot' }));
  const invalid = await submit(booking({ email: 'not-an-address' }));
  assert.equal(invalid.statusCode, 422);
  assert.equal(net.calls.length, 0);
});

const FAILURES = [
  ['rejects the email', () => json({ name: 'validation_error', message: 'bad jane@example.com' }, 422)],
  ['is down', () => new Response('gateway error', { status: 500 })],
  ['cannot be reached', () => { throw new TypeError('network failed for jane@example.com'); }],
];
for (const [what, resend] of FAILURES) {
  test(`the visitor still succeeds when Resend ${what}`, async (t) => {
    const net = setup(t, { resend });
    const res = await submit(booking());
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    const log = net.logs.join('\n');
    assert.match(log, /FORGE-1A2B3C4D/, 'the log should say which registration was not emailed');
    assert.doesNotMatch(log, /jane@example\.com|Jane Cruz|re_test_key/, 'logs must not hold personal data or the key');
  });
}

test('without an API key the registration succeeds and the missing email is logged', async (t) => {
  const net = setup(t, { env: { RESEND_API_KEY: undefined } });
  const res = await submit(booking());
  assert.equal(res.statusCode, 200);
  assert.equal(net.emails().length, 0);
  assert.match(net.logs.join('\n'), /RESEND_API_KEY/);
});

test('typed line breaks cannot forge lines in the email', async (t) => {
  const net = setup(t);
  await submit(booking({ fullName: 'Jane\r\nReference: FAKE', notes: 'hello\nReference: FAKE\u2028Consent given: No' }));
  const { subject, text } = net.emails()[0].body;
  assert.doesNotMatch(subject, /[\r\n\u2028]/);
  assert.doesNotMatch(text, /^Reference: FAKE|^Consent given: No/m);
  assert.match(text, /^ {4}Reference: FAKE$/m, 'multi line answers are kept, indented');
});

const RISKY = ['jane,boss@example.com', 'jane..doe@example.com', '.jane@example.com', 'jane.@example.com', 'jane@example..com', 'jane@-example.com', 'jane@.example.com'];
for (const address of RISKY) {
  test(`${address} is shown but not used as reply to`, async (t) => {
    const net = setup(t);
    await submit(booking({ email: address }));
    const { body } = net.emails()[0];
    assert.equal(body.reply_to, undefined);
    assert.ok(body.text.includes(`Email: ${address}`));
  });
}

test('an ordinary address with dots, plus and apostrophe is used as reply to', async (t) => {
  const net = setup(t);
  await submit(booking({ email: "jane.o'neil+forge@mail.example.com.ph" }));
  assert.equal(net.emails()[0].body.reply_to, "jane.o'neil+forge@mail.example.com.ph");
});

test('the function is allowed enough time to save and then email', async () => {
  const { EMAIL_TIMEOUT_MS } = await import('../api/_email.js');
  const sheetTimeout = Number(read('api/register.js').match(/WEBHOOK_TIMEOUT_MS = (\d+)/)[1]);
  const { maxDuration } = JSON.parse(read('vercel.json')).functions['api/register.js'];
  assert.ok(maxDuration * 1000 >= sheetTimeout + EMAIL_TIMEOUT_MS + 2000, `maxDuration of ${maxDuration}s is too short`);
});

test('the privacy notice names the email service and carries the date of that change', () => {
  const notice = read('src/sections/legal/legal.html');
  assert.match(notice, /Resend/);
  assert.match(notice, /Last updated 27 November 2026/);
});
