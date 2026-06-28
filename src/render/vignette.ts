// Low-HP vignette (0.7.0 VFX pass): a red screen-edge glow that intensifies as health
// drops below a threshold — a readability "juice" cue (UX_AND_ACCESSIBILITY → combat
// feedback) that honours the reduced-effects setting (capped, no flashing). The opacity
// curve is a pure function so it's unit-tested without a DOM.

/** HP fraction at/below which the vignette starts showing. */
const THRESHOLD = 0.35;

/** Vignette opacity for a health fraction; 0 above the threshold, ramping toward max. */
export function vignetteOpacity(hpRatio: number, reduced: boolean): number {
  const r = Math.min(1, Math.max(0, hpRatio));
  if (r >= THRESHOLD) return 0;
  const t = (THRESHOLD - r) / THRESHOLD; // 0 at the threshold → 1 at 0 HP
  const max = reduced ? 0.2 : 0.55; // reduced-effects keeps it a subtle hint
  return Math.round(t * max * 1000) / 1000;
}

export class Vignette {
  private readonly el: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'low-hp-vignette';
    parent.appendChild(this.el);
  }

  update(hpRatio: number, reduced: boolean): void {
    this.el.style.opacity = String(vignetteOpacity(hpRatio, reduced));
  }
}
