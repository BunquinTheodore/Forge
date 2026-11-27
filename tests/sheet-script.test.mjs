import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The Apps Script behind the Google Sheet can email whoever filled the form. Only the Google services are faked.
const code = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs/apps-script/Code.gs'), 'utf8');

function greetingFor(fullName) {
  const sent = [];
  const props = { getProperty: () => null, setProperty() {} };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => '20261127' },
    MailApp: { sendEmail: (message) => sent.push(message) },
  });
  vm.runInContext(code, context);
  context.sendConfirmation({ form: 'conference', email: 'jane@example.com', fullName, reference: 'FORGE-1A2B3C4D' });
  return sent[0].body.split('\n')[0];
}

const CASES = [
  ['Jane Cruz', 'Hello Jane,'],
  ["D'Angelo Cruz", "Hello D'Angelo,"],
  ['Ma. Cristina Santos', 'Hello Ma.,'],
  ['URGENT:\nVerify\nat\nhttps://evil.example/login', 'Hello,'],
  ['https://evil.example/login', 'Hello,'],
  ['Your-account-is-locked-reply-with-OTP', 'Hello,'],
];
for (const [fullName, greeting] of CASES) {
  test(`the sheet script greets ${JSON.stringify(fullName)} with "${greeting}"`, () => {
    assert.equal(greetingFor(fullName), greeting);
  });
}
