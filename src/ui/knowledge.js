// "What I Know" — the snake's beliefs, with how sure it is of each.
//
// Beliefs it has not begun to form are not listed at all. You cannot see the
// shape of what it is about to work out, which is the point.

import { BELIEFS, TIERS } from '../mind/beliefs.js';

export class KnowledgePanel {
  constructor(el, meterEl, labelEl) {
    this.el = el;
    this.meterEl = meterEl;
    this.labelEl = labelEl;
    this.rows = new Map();
    this.lastSignature = '';
  }

  render(mind) {
    const visible = BELIEFS.filter((b) => mind.confidence[b.id] > 0.02);

    // Re-render only when something actually changed.
    const signature = visible
      .map((b) => `${b.id}:${Math.round(mind.confidence[b.id] * 20)}`)
      .join('|');
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.renderRows(visible, mind);
    }

    const k = mind.knowledge;
    this.meterEl.style.setProperty('--fill', `${(k * 100).toFixed(1)}%`);
    this.labelEl.textContent = `${TIERS[mind.tier].name} · ${Math.round(k * 100)}% understood`;
  }

  renderRows(visible, mind) {
    for (const belief of visible) {
      let row = this.rows.get(belief.id);
      if (!row) {
        row = document.createElement('li');
        row.className = 'belief';
        row.innerHTML = `
          <span class="belief__bar"><i></i></span>
          <span class="belief__text"></span>
        `;
        row.querySelector('.belief__text').textContent = belief.label;
        this.rows.set(belief.id, row);
        this.el.appendChild(row);
      }
      const c = mind.confidence[belief.id];
      row.querySelector('.belief__bar i').style.width = `${(c * 100).toFixed(0)}%`;
      row.classList.toggle('is-known', c >= 0.75);
      row.classList.toggle('is-hunch', c < 0.35);
    }

    if (!visible.length && !this.el.childElementCount) {
      const empty = document.createElement('li');
      empty.className = 'belief belief--empty';
      empty.textContent = 'nothing yet';
      this.el.appendChild(empty);
      this.rows.set('__empty', empty);
    } else if (visible.length && this.rows.has('__empty')) {
      this.rows.get('__empty').remove();
      this.rows.delete('__empty');
    }
  }

  reset() {
    this.el.replaceChildren();
    this.rows.clear();
    this.lastSignature = '';
  }
}
