/**
 * FORGE PH 2027 registration receiver (Google Apps Script web app).
 *
 * It lives inside a Google Sheet owned by ICCPI. The website's /api/register function posts each
 * validated registration here; the script checks a shared secret, appends one row to the tab for that
 * form (Conference, Booth, Workshop) and emails the registration team.
 *
 * Setup: see docs/registration-setup.md. Script properties required (Project Settings > Script properties):
 *   SECRET          long random string, the same value as REGISTRATION_WEBHOOK_SECRET on Vercel
 *   NOTIFY_EMAILS   comma separated, e.g. info@iccpi.org.ph,f.calabretta@iccpi.org.ph
 */

var TABS = { conference: 'Conference', booth: 'Booth', workshop: 'Workshop' };

var COLUMNS = {
  conference: ['reference', 'submittedAt', 'fullName', 'email', 'phone', 'jobTitle', 'organization', 'country', 'businessCategory', 'sector', 'participants', 'otherAttendees', 'interests', 'notes', 'consent'],
  booth: ['reference', 'submittedAt', 'fullName', 'email', 'phone', 'jobTitle', 'organization', 'country', 'businessCategory', 'sector', 'companyUrl', 'boothPackage', 'boothDescription', 'boothRequirements', 'interests', 'notes', 'consent'],
  workshop: ['reference', 'submittedAt', 'fullName', 'email', 'phone', 'jobTitle', 'organization', 'country', 'businessCategory', 'sector', 'participateAs', 'stage', 'summary', 'supportSought', 'interests', 'notes', 'consent'],
};

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad_json' });
  }
  var secret = props.getProperty('SECRET');
  // Fail closed: with no SECRET configured, nothing is accepted.
  if (!secret || !payload || payload.secret !== secret) {
    return json({ ok: false, error: 'forbidden' });
  }

  var record = payload.record || {};
  var columns = COLUMNS[record.form];
  if (!columns) return json({ ok: false, error: 'unknown_form' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = tabFor(record.form, columns);
    // A retry of the same submission carries the same reference: do not add a second row.
    if (sheet.getLastRow() > 1 && referenceExists(sheet, record.reference)) return json({ ok: true, duplicate: true });
    var row = columns.map(function (c) { return record[c] === undefined ? '' : String(record[c]); });
    var target = sheet.getRange(sheet.getLastRow() + 1, 1, 1, columns.length);
    target.setNumberFormat('@'); // store as plain text so nothing is interpreted as a formula
    target.setValues([row]);
  } finally {
    lock.releaseLock();
  }

  // The row is already saved. An email problem must never turn a saved registration into an error for the visitor.
  try {
    notify(record);
    sendConfirmation(record);
  } catch (err) {
    console.error('email failed: ' + err);
  }
  return json({ ok: true });
}

function referenceExists(sheet, reference) {
  var found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(reference).matchEntireCell(true).findNext();
  return found !== null;
}

/** Returns the tab for a form, creating it with a frozen header row the first time. */
function tabFor(form, columns) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(TABS[form]);
  if (!sheet) {
    sheet = book.insertSheet(TABS[form]);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Google limits how many recipients a script may email per day (100 for a free Gmail account, 1500 for Workspace).
// The team notification has priority: confirmations stop earlier so the team always hears about a registration.
var NOTIFY_LIMIT = 90;
var CONFIRM_LIMIT = 60;

/** Counts today's recipients in a script property, under the lock, so concurrent submissions cannot under-count. */
function reserveEmail(recipients, limit) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'emails-' + Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyyMMdd');
    var sent = Number(props.getProperty(key) || 0);
    if (sent + recipients > limit) return false;
    props.setProperty(key, String(sent + recipients));
    return true;
  } finally {
    lock.releaseLock();
  }
}

function notify(record) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAILS');
  if (!to) return;
  if (!reserveEmail(to.split(',').length, NOTIFY_LIMIT)) return;
  var lines = ['New FORGE PH 2027 ' + record.form + ' submission', 'Reference: ' + record.reference, 'Name: ' + record.fullName, 'Organization: ' + record.organization, 'Email: ' + record.email, '', 'Open the Google Sheet to see the full details.'];
  try {
    MailApp.sendEmail({ to: to, subject: 'FORGE PH 2027: new ' + record.form + ' submission (' + record.reference + ')', body: lines.join('\n') });
  } catch (err) {
    console.error('notify failed: ' + err);
  }
}

/** Confirmation to the person who registered (switch off with the script property CONFIRMATION_EMAIL = off). */
function sendConfirmation(record) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('CONFIRMATION_EMAIL') === 'off') return;
  var to = String(record.email || '');
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(to)) return;
  if (!reserveEmail(1, CONFIRM_LIMIT)) return;
  var what = { conference: 'conference registration', booth: 'booth application', workshop: 'workshop and FD90 interest' }[record.form] || 'registration';
  var lines = [
    'Hello ' + String(record.fullName || '').split(' ')[0] + ',',
    '',
    'Thank you. We have received your ' + what + ' for FORGE PH 2027.',
    'Your reference: ' + record.reference,
    '',
    'When: 27 January 2027, 10:00 AM to 6:00 PM',
    'Where: WhiteSpace, Makati, Philippines',
    '',
    'The ICCPI team will write to you with the next steps. If you have a question, reply to this email or write to info@iccpi.org.ph or f.calabretta@iccpi.org.ph.',
    '',
    'FORGE PH 2027, presented by the Italian Chamber of Commerce in the Philippines',
    'https://www.forgeph.org'
  ];
  MailApp.sendEmail({ to: to, replyTo: 'info@iccpi.org.ph', name: 'FORGE PH 2027', subject: 'FORGE PH 2027: we received your ' + what + ' (' + record.reference + ')', body: lines.join('\n') });
}
