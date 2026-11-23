import { FORMS } from '../../../shared/registration.js';

const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
};

const fieldId = (name) => `f-${name}`;

/** Label text plus the required marker (the marker is decorative: aria-required carries the meaning). */
const labelNode = (field, forId) => el('label', { class: 'field__label', for: forId }, [
  field.label,
  field.required ? el('span', { class: 'field__req', 'aria-hidden': 'true', text: ' *' }) : null,
]);

function describedBy(field) {
  return [field.hint ? `${fieldId(field.name)}-hint` : null, `${fieldId(field.name)}-err`].filter(Boolean).join(' ');
}

function textControl(field) {
  const id = fieldId(field.name);
  const common = {
    id, name: field.name, maxlength: field.max, autocomplete: field.autocomplete,
    'aria-required': field.required ? 'true' : null, 'aria-describedby': describedBy(field),
  };
  if (field.type === 'textarea') return el('textarea', { ...common, rows: 4 });
  return el('input', { ...common, type: field.type === 'email' || field.type === 'tel' ? field.type : 'text' });
}

function selectControl(field) {
  const id = fieldId(field.name);
  const select = el('select', { id, name: field.name, 'aria-required': field.required ? 'true' : null, 'aria-describedby': describedBy(field) });
  select.append(el('option', { value: '', text: 'Select' }));
  for (const option of field.options) select.append(el('option', { value: option, text: option }));
  return select;
}

function checkboxGroup(field) {
  const id = fieldId(field.name);
  const wrap = el('div', { class: 'checks', id, role: 'group', 'aria-labelledby': `${id}-legend`, 'aria-describedby': describedBy(field) });
  field.options.forEach((option, i) => {
    const input = el('input', { type: 'checkbox', name: field.name, value: option, id: `${id}-${i}` });
    if (field.defaults?.includes(option)) input.checked = true;
    wrap.append(el('label', { class: 'check', for: `${id}-${i}` }, [input, el('span', { text: option })]));
  });
  return wrap;
}

function fieldNode(field) {
  const id = fieldId(field.name);
  const hint = field.hint ? el('p', { class: 'field__hint', id: `${id}-hint`, text: field.hint }) : null;
  const error = el('p', { class: 'field__err', id: `${id}-err`, hidden: true });

  if (field.type === 'consent') {
    const input = el('input', { type: 'checkbox', name: field.name, id, 'aria-required': 'true', 'aria-describedby': `${id}-err` });
    return el('div', { class: 'field field--consent', 'data-field': field.name }, [
      el('label', { class: 'check', for: id }, [input, el('span', { text: field.label })]),
      error,
    ]);
  }
  if (field.type === 'checkboxes') {
    return el('div', { class: 'field field--checks', 'data-field': field.name }, [
      el('p', { class: 'field__label', id: `${id}-legend` }, [field.label, field.required ? el('span', { class: 'field__req', 'aria-hidden': 'true', text: ' *' }) : null]),
      hint, checkboxGroup(field), error,
    ]);
  }
  const control = field.type === 'select' ? selectControl(field) : textControl(field);
  return el('div', { class: `field field--${field.type}`, 'data-field': field.name }, [labelNode(field, id), control, hint, error]);
}

/** Build the form body (grouped fieldsets, honeypot, submit) from the shared schema. */
export function buildFields(formKey, mount) {
  const form = FORMS[formKey];
  const groups = [...new Set(form.fields.map((f) => f.group))];
  const frag = document.createDocumentFragment();
  for (const group of groups) {
    const set = el('fieldset', { class: 'group' }, [el('legend', { class: 'group__legend', text: group })]);
    const grid = el('div', { class: 'group__grid' });
    form.fields.filter((f) => f.group === group).forEach((f) => grid.append(fieldNode(f)));
    set.append(grid);
    frag.append(set);
  }
  frag.append(el('div', { class: 'hp', 'aria-hidden': 'true' }, [
    el('label', {}, ['Leave this field empty', el('input', { type: 'text', name: 'hp', tabindex: '-1', autocomplete: 'off' })]),
  ]));
  mount.replaceChildren(frag);
}

/** Read the current values out of the form, in the shape validate() expects. */
export function readValues(formKey, root) {
  const values = {};
  for (const field of FORMS[formKey].fields) {
    if (field.type === 'checkboxes') {
      values[field.name] = Array.from(root.querySelectorAll(`input[name="${field.name}"]:checked`)).map((i) => i.value);
    } else if (field.type === 'consent') {
      values[field.name] = Boolean(root.querySelector(`input[name="${field.name}"]`)?.checked);
    } else {
      values[field.name] = root.querySelector(`[name="${field.name}"]`)?.value ?? '';
    }
  }
  return values;
}
