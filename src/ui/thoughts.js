// The thought stream: everything the snake says, in the order it says it.

const MAX_NODES = 90;

export class ThoughtStream {
  constructor(el) {
    this.el = el;
    this.pinned = true;

    // If the reader scrolls up to re-read something, stop yanking them down.
    this.el.addEventListener('scroll', () => {
      const nearBottom =
        this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight < 48;
      this.pinned = nearBottom;
    });
  }

  push({ text, kind, tier }) {
    const line = document.createElement('p');
    line.className = `thought thought--${kind} tier-${tier ?? 0}`;
    line.textContent = text;
    this.el.appendChild(line);

    while (this.el.childElementCount > MAX_NODES) {
      this.el.removeChild(this.el.firstElementChild);
    }
    // Let the fade-in run before scrolling, or it lands mid-animation.
    requestAnimationFrame(() => {
      if (this.pinned) this.el.scrollTop = this.el.scrollHeight;
    });
  }

  clear() {
    this.el.replaceChildren();
  }
}
