/**
 * Splits the text of an element into word spans while keeping inline markup (em, strong).
 * The accessible text is unchanged: spans only wrap words, whitespace text nodes are preserved.
 * Shared by the thesis and problem sections (both owned by the same group).
 */
export class WordSplit {
  constructor(root, className = 'w') {
    this.root = root;
    this.className = className;
    this.words = [];
    this.#walk(root, false);
  }

  #walk(node, inEm) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) this.#splitText(child, inEm);
      else if (child.nodeType === Node.ELEMENT_NODE) this.#walk(child, inEm || child.tagName === 'EM');
    }
  }

  #splitText(textNode, inEm) {
    const parts = textNode.textContent.split(/(\s+)/);
    if (parts.every((p) => !p.trim())) return;
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (!part.trim()) {
        frag.appendChild(document.createTextNode(' '));
        continue;
      }
      const span = document.createElement('span');
      span.className = inEm ? `${this.className} ${this.className}--key` : this.className;
      span.textContent = part;
      span.dataset.text = part;
      frag.appendChild(span);
      this.words.push(span);
    }
    textNode.replaceWith(frag);
  }

  get keys() {
    return this.words.filter((w) => w.classList.contains(`${this.className}--key`));
  }
}
