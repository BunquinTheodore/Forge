/**
 * The designed confirmation email. Mail apps need old fashioned markup: tables, inline styles, no style sheets.
 * Colours match src/styles/tokens.css. The logo is a PNG because some mail apps cannot show WebP.
 */

export const EVENT = {
  date: '27 January 2027',
  time: '10:00 AM to 6:00 PM',
  venue: 'WhiteSpace, Makati, Philippines',
};
export const CONTACTS = ['info@iccpi.org.ph', 'f.calabretta@iccpi.org.ph'];

const SITE = 'https://www.forgeph.org';
const INK = '#080b0e';
const INK_DEEP = '#050709';
const NAVY = '#101925';
const STEEL = '#293342';
const CREAM = '#f5f0e8';
const BONE = '#d8d0c5';
const FOG = '#aeb7c4';
const MUTE = '#7f8996';
const EMBER = '#e85b22';
const EMBER_DEEP = '#a8340f';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = 'Arial, Helvetica, sans-serif';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);

const table = (rows, attrs = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${attrs}>${rows}</table>`;
const row = (content, style, attrs = '') => `<tr><td${attrs} style="${style}">${content}</td></tr>`;
const label = (text, colour) => `<span style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${colour};">${text}</span>`;
const link = (href, text, colour) => `<a href="${href}" style="color:${colour};text-decoration:underline;">${text}</a>`;

const header = () => row(
  `<div style="font-family:'Arial Black',${SANS};font-size:30px;line-height:1;font-weight:900;letter-spacing:2px;white-space:nowrap;color:${CREAM};">FORGE <span style="color:${EMBER};">PH</span><span style="font-family:${SANS};font-size:12px;letter-spacing:1px;vertical-align:top;color:${FOG};">&nbsp;2027</span></div>`
  // Broken by hand into short lines, so no screen is narrow enough to split Cross-Industry at its hyphen.
  + `<div style="padding-top:14px;line-height:1.8;">${label('The International<br />Cross-Industry<br />Startup Forum', FOG)}</div>`,
  'padding:32px 28px 8px;',
);

const headline = (greeting, what) => row(
  `<h1 style="margin:0;font-family:${SERIF};font-size:30px;line-height:1.25;font-weight:normal;color:${CREAM};">Thank you.<br /><em style="color:${EMBER};">We received your ${what}.</em></h1>`
  + `<p style="margin:20px 0 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${BONE};">${greeting}</p>`
  + `<p style="margin:8px 0 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${BONE};">The ICCPI team will write to you with the next steps.</p>`,
  'padding:28px 28px 24px;',
);

const referenceCard = (reference) => row(
  table(row(
    `${label('Your reference', FOG)}<div style="padding-top:8px;font-family:${SANS};font-size:18px;font-weight:bold;letter-spacing:1px;white-space:nowrap;color:${EMBER};">${reference}</div>`,
    `padding:20px 18px;border:1px solid ${STEEL};border-radius:12px;`,
  ), ` bgcolor="${NAVY}" style="background-color:${NAVY};border-radius:12px;"`),
  'padding:0 28px 20px;',
);

function details() {
  const facts = [['Date', EVENT.date], ['Time', EVENT.time], ['Venue', EVENT.venue]];
  const rows = facts.map(([name, value], i) => {
    const rule = i ? `border-top:1px solid ${BONE};` : '';
    return `<tr><td width="76" valign="top" style="padding:14px 0;${rule}line-height:22px;">${label(name, EMBER_DEEP)}</td>`
      + `<td valign="top" style="padding:14px 0 14px 12px;${rule}font-family:${SANS};font-size:15px;line-height:22px;color:${INK};">${value.replace(/ (AM|PM)/g, '&nbsp;$1')}</td></tr>`;
  }).join('');
  return row(
    table(row(table(rows), 'padding:6px 22px;'), ` bgcolor="${CREAM}" style="background-color:${CREAM};border-radius:12px;"`),
    'padding:0 28px 24px;',
  );
}

const button = (href, text, background, colour, border) => table(
  row(
    `<a href="${href}" style="display:block;padding:15px 20px;font-family:${SANS};font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;color:${colour};">${text}</a>`,
    `border:1px solid ${border};border-radius:40px;text-align:center;`,
    ` align="center" bgcolor="${background}"`,
  ),
  ` style="border-collapse:separate;margin-bottom:12px;"`,
);

const buttons = () => row(
  button(`${SITE}/programme/`, 'View the programme', EMBER, INK, EMBER)
  + button(`${SITE}/forge-ph-2027.ics`, 'Add to calendar', INK, CREAM, STEEL),
  'padding:0 28px 24px;',
);

function footer() {
  const [first, second] = CONTACTS.map((address) => link(`mailto:${address}`, address, EMBER));
  const small = `margin:16px 0 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTE};`;
  return row(
    `${label('Presented by', FOG)}`
    + `<div style="padding-top:12px;"><img src="${SITE}/img/iccpi-email.png" width="120" height="109" alt="ICCPI, Italian Chamber of Commerce in the Philippines, Inc." style="display:block;border:0;border-radius:10px;background-color:#ffffff;font-family:${SANS};font-size:12px;color:${INK};" /></div>`
    + `<p style="margin:22px 0 0;font-family:${SANS};font-size:14px;line-height:1.7;color:${BONE};">Questions? Reply to this email or write to ${first} or ${second}.</p>`
    + `<p style="${small}">FORGE does not guarantee investment and does not remove investor judgment. Participation implies no endorsement. Programme details and participation arrangements will be progressively confirmed.</p>`
    + `<p style="${small}">${link(`${SITE}/`, 'forgeph.org', FOG)} &nbsp; ${link(`${SITE}/privacy/`, 'Privacy notice', FOG)}</p>`,
    `padding:24px 28px 32px;border-top:1px solid ${STEEL};`,
  );
}

/** @param {{ greeting: string, what: string, reference: string }} input  Plain text values: they are escaped here. */
export function confirmationHtml(input) {
  const greeting = escape(input.greeting);
  const what = escape(input.what);
  const reference = escape(input.reference);
  const card = table(
    header() + headline(greeting, what) + referenceCard(reference) + details() + buttons() + footer(),
    ` bgcolor="${INK}" style="max-width:600px;margin:0 auto;background-color:${INK};border-radius:16px;"`,
  );
  return '<!doctype html><html lang="en"><head><meta charset="utf-8" />'
    + '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    + '<meta name="color-scheme" content="dark light" /><title>FORGE PH 2027</title></head>'
    + `<body style="margin:0;padding:0;background-color:${INK_DEEP};">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your reference is ${reference}. ${EVENT.date}, ${EVENT.venue}.</div>`
    + table(row(
      `<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->${card}<!--[if mso]></td></tr></table><![endif]-->`,
      'padding:24px 12px;',
    ), ` bgcolor="${INK_DEEP}" style="background-color:${INK_DEEP};"`)
    + '</body></html>';
}
