// Performance overlay devtool: a DOM panel showing FPS, frame time, draw calls,
// entity count, sim steps, and an optional extra line. Planned devtool per
// docs/qa/TEST_STRATEGY.md. Excluded from production builds in a later phase.

const VERSION = '0.2.1-INDEV';

export class PerfOverlay {
  private readonly el: HTMLDivElement;
  private fpsEma = 60;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'perf-overlay';
    this.el.textContent = 'booting…';
    parent.appendChild(this.el);
  }

  update(
    frameMs: number,
    drawCalls: number,
    entities: number,
    steps: number,
    extra?: string,
  ): void {
    const instFps = frameMs > 0 ? 1000 / frameMs : 0;
    this.fpsEma += (instFps - this.fpsEma) * 0.1;
    let text =
      `Oathbound ${VERSION}\n` +
      `FPS  ${this.fpsEma.toFixed(0).padStart(3)}   (${frameMs.toFixed(1)} ms)\n` +
      `draw calls  ${drawCalls}\n` +
      `entities    ${entities}\n` +
      `sim steps   ${steps}`;
    if (extra) text += `\n${extra}`;
    this.el.textContent = text;
  }
}
