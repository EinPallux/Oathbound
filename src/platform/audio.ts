// Minimal procedural SFX via the Web Audio API — short oscillator blips, no assets
// (0.7.0 audio pass: a master volume + mute, driven by Settings). All blips route
// through a master GainNode so volume is one knob. Degrades silently where audio is
// unavailable. A fuller sampled-audio pass is deferred (kept dependency-free for now).

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Effective output volume in [0, 1] (mute = 0); see setVolume. */
  private volume = 0.7;
  enabled = true;

  private ac(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        this.master = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Set the master output volume (0..1). Applied live; 0 effectively mutes. */
  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  private blip(freq: number, durMs: number, type: OscillatorType, gain: number, delayMs = 0): void {
    const ctx = this.ac();
    if (!ctx || !this.master) return;
    if (this.volume <= 0) return; // muted — skip the work entirely
    const t0 = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000);
  }

  hit(): void {
    this.blip(200, 70, 'square', 0.04);
  }
  crit(): void {
    this.blip(420, 130, 'square', 0.06);
  }
  hurt(): void {
    this.blip(130, 150, 'sawtooth', 0.05);
  }
  death(): void {
    this.blip(160, 110, 'triangle', 0.05);
    this.blip(90, 200, 'triangle', 0.05, 60);
  }
  loot(): void {
    this.blip(640, 90, 'sine', 0.05);
    this.blip(860, 90, 'sine', 0.05, 70);
  }
  levelUp(): void {
    this.blip(523, 120, 'sine', 0.06);
    this.blip(659, 120, 'sine', 0.06, 110);
    this.blip(784, 160, 'sine', 0.06, 220);
  }
}
