/**
 * Registration schema: the single source of truth for the three FORGE PH 2027 forms.
 * The browser renders the forms from FORMS and validates with validate(); the serverless
 * function (api/register.js) runs the same validate() again, so the server never trusts the client.
 */

export const BUSINESS_CATEGORIES = [
  'Startup or founder',
  'Corporate or enterprise',
  'Investor or financial institution',
  'Professional services or capability provider',
  'Accelerator, incubator or university',
  'Government or institution',
  'Other',
];

export const SECTORS = [
  'Technology and software',
  'Manufacturing and industry',
  'Automotive and mobility',
  'Design, fashion and lifestyle',
  'Food and agriculture',
  'Finance and fintech',
  'Energy and sustainability',
  'Healthcare and life sciences',
  'Logistics and trade',
  'Education and research',
  'Professional services',
  'Other',
];

export const INTERESTS = [
  'Conference and programme',
  'Italy-Philippines business corridor',
  'Startup case studies',
  'Piaggio / Vespa experience',
  'Working tables and workshop',
  'FD90 90-day development',
  'FORGE NEXT',
  'International FORGE platform',
  'Investor and partner meetings',
  'Exhibiting',
];

const CONSENT_LABEL = 'I agree that ICCPI may process this information to manage my registration and contact me about FORGE PH 2027.';

/** Fields every form collects. `group` places them under a heading in the UI. */
const contactFields = [
  { name: 'fullName', label: 'Full name', type: 'text', required: true, max: 120, autocomplete: 'name', group: 'You' },
  { name: 'email', label: 'Email', type: 'email', required: true, max: 160, autocomplete: 'email', group: 'You' },
  { name: 'phone', label: 'Mobile number', type: 'tel', required: true, max: 40, autocomplete: 'tel', hint: 'Include the country code.', group: 'You' },
  { name: 'jobTitle', label: 'Job title', type: 'text', required: true, max: 120, autocomplete: 'organization-title', group: 'You' },
];

const organisationFields = [
  { name: 'organization', label: 'Organization', type: 'text', required: true, max: 160, autocomplete: 'organization', group: 'Your organization' },
  { name: 'country', label: 'Country', type: 'text', required: true, max: 80, autocomplete: 'country-name', group: 'Your organization' },
  { name: 'businessCategory', label: 'Business category', type: 'select', required: true, options: BUSINESS_CATEGORIES, group: 'Your organization' },
  { name: 'sector', label: 'Sector', type: 'select', required: true, options: SECTORS, group: 'Your organization' },
];

const closingFields = (defaults) => [
  {
    name: 'interests', label: 'Interest in FORGE activities', type: 'checkboxes', required: true, options: INTERESTS,
    hint: 'Choose at least one.', defaults, group: 'Your interest',
  },
  { name: 'notes', label: 'Anything else the ICCPI team should know', type: 'textarea', required: false, max: 1000, group: 'Your interest' },
  { name: 'consent', label: CONSENT_LABEL, type: 'consent', required: true, group: 'Consent' },
];

export const FORMS = {
  conference: {
    key: 'conference',
    title: 'Conference pass',
    price: 'PHP 5,000',
    priceNote: 'per participant',
    submitLabel: 'Submit registration',
    received: 'registration',
    fields: [
      ...contactFields,
      ...organisationFields,
      {
        name: 'participants', label: 'Number of participants', type: 'select', required: true,
        options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], group: 'Your pass',
      },
      {
        name: 'otherAttendees', label: 'Names of the other participants', type: 'textarea', required: false, max: 600,
        hint: 'If you are registering more than one participant.', group: 'Your pass',
      },
      ...closingFields(['Conference and programme']),
    ],
  },
  booth: {
    key: 'booth',
    title: 'Exhibition booth',
    price: 'PHP 15,000 to 55,000',
    priceNote: 'packages at 15,000, 35,000 and 55,000',
    submitLabel: 'Submit booth application',
    received: 'application',
    fields: [
      ...contactFields,
      ...organisationFields,
      { name: 'companyUrl', label: 'Website', type: 'text', required: false, max: 200, autocomplete: 'url', group: 'Your booth' },
      { name: 'boothPackage', label: 'Booth package', type: 'select', required: true, options: ['PHP 15,000', 'PHP 35,000', 'PHP 55,000'], group: 'Your booth' },
      { name: 'boothDescription', label: 'What will you exhibit?', type: 'textarea', required: true, max: 800, group: 'Your booth' },
      { name: 'boothRequirements', label: 'Special requirements', type: 'textarea', required: false, max: 600, group: 'Your booth' },
      ...closingFields(['Exhibiting']),
    ],
  },
  workshop: {
    key: 'workshop',
    title: 'Workshop and FD90',
    price: 'Expression of interest',
    priceNote: 'no payment at this stage',
    submitLabel: 'Send my interest',
    received: 'interest',
    fields: [
      ...contactFields,
      ...organisationFields,
      {
        name: 'participateAs', label: 'I would take part as', type: 'select', required: true,
        options: ['Startup or venture', 'Capability provider', 'Investor', 'Corporate partner', 'Mentor or advisor', 'Other'], group: 'Your participation',
      },
      {
        name: 'stage', label: 'Venture stage', type: 'select', required: true,
        options: ['Idea', 'Prototype or MVP', 'Early revenue', 'Growth', 'Not applicable'], group: 'Your participation',
      },
      { name: 'summary', label: 'About your venture, or what you bring', type: 'textarea', required: true, max: 800, group: 'Your participation' },
      { name: 'supportSought', label: 'Support or partnerships you are looking for', type: 'textarea', required: false, max: 600, group: 'Your participation' },
      ...closingFields(['Working tables and workshop', 'FD90 90-day development']),
    ],
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\d][\d\s().+-]{5,39}$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const clean = (value) => String(value ?? '').replace(CONTROL, '').trim();

function checkText(field, raw) {
  const v = clean(raw);
  if (!v) return { value: '', error: field.required ? 'This field is required.' : null };
  if (v.length > field.max) return { value: v, error: `Please keep this under ${field.max} characters.` };
  if (field.type === 'email' && !EMAIL.test(v)) return { value: v, error: 'Enter a valid email address.' };
  if (field.type === 'tel' && !PHONE.test(v)) return { value: v, error: 'Enter a valid phone number.' };
  return { value: v, error: null };
}

function checkSelect(field, raw) {
  const v = clean(raw);
  if (!v) return { value: '', error: field.required ? 'Please choose an option.' : null };
  if (!field.options.includes(v)) return { value: '', error: 'Please choose one of the listed options.' };
  return { value: v, error: null };
}

function checkBoxes(field, raw) {
  const list = Array.isArray(raw) ? raw.map(clean) : [];
  if (list.some((v) => !field.options.includes(v))) return { value: [], error: 'Please choose from the listed options.' };
  const unique = [...new Set(list)];
  if (field.required && unique.length === 0) return { value: [], error: 'Choose at least one.' };
  return { value: unique, error: null };
}

/**
 * Validate and normalise a submission.
 * @returns {{ ok: boolean, errors: Record<string,string>, values: Record<string,string|string[]|boolean> }}
 */
export function validate(formKey, input) {
  const form = typeof formKey === 'string' && Object.prototype.hasOwnProperty.call(FORMS, formKey) ? FORMS[formKey] : null;
  if (!form) return { ok: false, errors: { form: 'Unknown form.' }, values: {} };
  const source = input && typeof input === 'object' ? input : {};
  const errors = {};
  const values = {};
  for (const field of form.fields) {
    let result;
    if (field.type === 'select') result = checkSelect(field, source[field.name]);
    else if (field.type === 'checkboxes') result = checkBoxes(field, source[field.name]);
    else if (field.type === 'consent') result = { value: source[field.name] === true, error: source[field.name] === true ? null : 'Please confirm to continue.' };
    else result = checkText(field, source[field.name]);
    values[field.name] = result.value;
    if (result.error) errors[field.name] = result.error;
  }
  return { ok: Object.keys(errors).length === 0, errors, values };
}
