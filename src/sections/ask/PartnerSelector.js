const ADDRESS = 'forge@iccpi.com.ph';

/** Partner types. Copy derived from the deck's "What FORGE needs now" and "The ask". */
const ROLES = {
  launch: {
    name: 'Launch partner',
    need: 'launch',
    line: 'I would like to support the first FORGE cycle as a launch partner.',
  },
  capital: {
    name: 'Capital partner',
    need: 'capital',
    line: 'I would like to support the first FORGE cycle as a capital partner.',
  },
  capability: {
    name: 'Capability partner',
    need: 'capability',
    line: 'I would like to support the first FORGE cycle as a capability partner.',
  },
  pipeline: {
    name: 'Pipeline partner',
    need: 'pipeline',
    line: 'I would like to support the first FORGE cycle as a pipeline partner.',
  },
  founder: {
    name: 'Founder or startup',
    need: 'pipeline',
    line: 'I would like to enter FORGE as a founder or startup with clear needs and evidence.',
  },
};

/**
 * Partner type selector. Native radio group (arrow keys work out of the box) that rewrites
 * every [data-mail] link in the section with a pre-filled subject and body, updates the
 * readout and lights the matching need in the list above.
 */
export class PartnerSelector {
  constructor(section) {
    this.section = section;
    this.inputs = section.$$('input[name="ask-role"]');
    this.links = section.$$('[data-mail]');
    this.roleEl = section.$('.ask__role');
    this.needEl = section.$('.ask__role-need-t');
    this.needs = new Map(section.$$('[data-need]').map((li) => [li.dataset.need, li]));
    this.readout = section.$('.ask__readout');
  }

  init() {
    for (const input of this.inputs) {
      this.section.listen(input, 'change', () => input.checked && this.select(input.value));
    }
    const current = this.inputs.find((i) => i.checked)?.value || 'launch';
    this.select(current, true);
  }

  select(key, silent = false) {
    const role = ROLES[key];
    if (!role) return;
    const href = PartnerSelector.mailto(role);
    const text = `Email FORGE as ${PartnerSelector.article(role.name)} ${role.name.toLowerCase()}`;
    for (const a of this.links) {
      a.href = href;
      a.textContent = text;
    }
    if (this.roleEl) this.roleEl.textContent = role.name;
    const needLi = this.needs.get(role.need);
    if (this.needEl && needLi) this.needEl.textContent = needLi.textContent.trim();
    this.needs.forEach((li, k) => li.classList.toggle('is-lit', k === role.need));
    if (!silent) this.#pulse();
  }

  #pulse() {
    if (!this.readout || this.section.reducedMotion) return;
    this.readout.classList.remove('is-swap');
    // restart the CSS keyframe on the next frame
    requestAnimationFrame(() => this.readout.classList.add('is-swap'));
  }

  static article(name) {
    return /^[aeiou]/i.test(name) ? 'an' : 'a';
  }

  static mailto(role) {
    const subject = `FORGE PH: ${role.name}`;
    const body = [
      'Hello FORGE team,',
      '',
      role.line,
      '',
      'Name:',
      'Organisation:',
      'What we bring:',
      '',
    ].join('\n');
    return `mailto:${ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}
