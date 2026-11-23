import { BaseSection } from '../../core/BaseSection.js';
import { rise } from '../../core/reveal.js';
import { FORMS, validate } from '../../../shared/registration.js';
import { buildFields, readValues } from './FormBuilder.js';

const ENDPOINT = '/api/register';
const FALLBACK_EMAILS = 'info@iccpi.org.ph and f.calabretta@iccpi.org.ph';
const MESSAGES = {
  not_configured: `Online registration is being finalised. Please email ${FALLBACK_EMAILS} with your details and we will register you.`,
  rate: 'Too many attempts. Please wait a few minutes and try again.',
  origin: `This page is not allowed to send registrations. Please email ${FALLBACK_EMAILS}.`,
  default: `We could not send your registration. Please try again, or email ${FALLBACK_EMAILS}.`,
};

/**
 * REGISTER: one section class for the three registration pages. The form comes from shared/registration.js,
 * is validated in the browser and again on the server, and is sent to /api/register.
 */
export default class RegisterSection extends BaseSection {
  static id = 'register';

  /** One id per form visit, reused on retry. Random bytes only, so two visitors can never share one. */
  static newSubmissionId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  init() {
    this.formKey = this.el.dataset.form;
    this.config = FORMS[this.formKey];
    this.form = this.$('[data-register-form]');
    if (!this.config || !this.form) return;

    buildFields(this.formKey, this.$('[data-fields]'));
    this.status = this.$('[data-status]');
    this.submit = this.$('[data-submit]');
    this.done = this.$('[data-done]');
    this.sending = false;
    this.submissionId = RegisterSection.newSubmissionId();
    this.submit.textContent = this.config.submitLabel;

    this.listen(this.form, 'submit', (e) => this.#onSubmit(e), { passive: false });
    this.listen(this.form, 'focusout', (e) => this.#onBlur(e));
    this.listen(this.form, 'input', (e) => this.#clear(e.target.closest('[data-field]')));
    this.listen(this.form, 'change', (e) => this.#clear(e.target.closest('[data-field]')));

    if (!this.reducedMotion) {
      this.gsap(() => rise(this.$$('.register__side, .register__form'), this.el, { y: 36, stagger: 0.15, delay: 0.1, start: 'top 90%' }));
    }
  }

  #onBlur(e) {
    const wrap = e.target.closest('[data-field]');
    if (!wrap || wrap.dataset.field === 'interests' || e.relatedTarget === this.submit) return;
    const { errors } = validate(this.formKey, readValues(this.formKey, this.form));
    this.#setError(wrap, errors[wrap.dataset.field]);
  }

  #clear(wrap) {
    if (wrap) this.#setError(wrap, null);
  }

  #setError(wrap, message) {
    const err = wrap.querySelector('.field__err');
    const control = wrap.querySelector('input, select, textarea');
    err.hidden = !message;
    err.textContent = message || '';
    wrap.classList.toggle('has-error', Boolean(message));
    wrap.querySelectorAll('input, select, textarea').forEach((c) => c.setAttribute('aria-invalid', message ? 'true' : 'false'));
    return control;
  }

  #showErrors(errors) {
    const names = Object.keys(errors);
    let first = null;
    for (const wrap of this.$$('[data-field]')) {
      const message = errors[wrap.dataset.field];
      const control = this.#setError(wrap, message);
      if (message && !first) first = control;
    }
    if (!names.length) return;
    this.#notice(`Please check ${names.length === 1 ? 'one field' : `${names.length} fields`} below.`, 'error');
    first?.focus({ preventScroll: false });
  }

  #notice(text, kind) {
    this.status.textContent = text;
    this.status.dataset.kind = kind || '';
    this.status.hidden = !text;
  }

  async #onSubmit(e) {
    e.preventDefault();
    if (this.sending) return;
    const values = readValues(this.formKey, this.form);
    const { ok, errors } = validate(this.formKey, values);
    this.#notice('', '');
    if (!ok) { this.#showErrors(errors); return; }

    this.#busy(true);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form: this.formKey, submissionId: this.submissionId, values, hp: this.form.elements.hp?.value || '' }),
      });
      const reply = await response.json().catch(() => ({}));
      if (response.ok && reply.ok) this.#success(reply.reference, values.email);
      else if (response.status === 422 && reply.errors) this.#showErrors(reply.errors);
      else this.#notice(MESSAGES[reply.code] || MESSAGES.default, 'error');
    } catch {
      this.#notice(MESSAGES.default, 'error');
    } finally {
      this.#busy(false);
    }
  }

  #busy(on) {
    this.sending = on;
    this.submit.disabled = on;
    this.submit.textContent = on ? 'Sending' : this.config.submitLabel;
    this.form.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  #success(reference, email) {
    const heading = this.$('.register__done-h');
    const em = document.createElement('em');
    em.textContent = `Your ${this.config.received} is received.`;
    heading.replaceChildren('Thank you. ', em);
    this.$('[data-ref]').textContent = reference;
    this.$('[data-email]').textContent = email;
    this.form.hidden = true;
    this.$('.register__h').hidden = true;
    this.done.hidden = false;
    this.done.setAttribute('tabindex', '-1');
    this.done.focus();
    this.done.scrollIntoView({ block: 'start', behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }
}
