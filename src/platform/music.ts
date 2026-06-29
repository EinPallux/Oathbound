// Looping background music. Asset-optional: drop a `bgm.mp3` (or .ogg / .wav) into the
// project's `public/` folder and it plays on loop; with no file present this is a silent
// no-op (the track is probed with a HEAD request first, so a missing file never logs a
// console error). Volume is driven by the same Settings knob as the SFX, scaled down so
// the music stays in the background. Honours browser autoplay policy: if the first play()
// is blocked, it retries on the next user interaction.

const CANDIDATES = ['bgm.mp3', 'bgm.ogg', 'bgm.wav'];

export class Music {
  private audio: HTMLAudioElement | null = null;
  private volume = 0.4;
  private starting = false;

  /** Locate and begin the loop. Safe to call repeatedly; only the first start takes. */
  async start(): Promise<void> {
    if (this.audio || this.starting) return;
    this.starting = true;
    try {
      const base = import.meta.env.BASE_URL || '/';
      for (const name of CANDIDATES) {
        const url = `${base}${name}`;
        if (await exists(url)) {
          const a = new Audio(url);
          a.loop = true;
          a.volume = this.volume;
          this.audio = a;
          this.play();
          return;
        }
      }
    } catch {
      // Probing failed (offline / unsupported) → stay silent.
    } finally {
      this.starting = false;
    }
  }

  private play(): void {
    const a = this.audio;
    if (!a) return;
    a.play().catch(() => {
      // Autoplay blocked → resume on the next gesture.
      const resume = (): void => {
        a.play().catch(() => {});
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
    });
  }

  /** Effective music volume in [0, 1] (0 mutes). Applied live. */
  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.audio) this.audio.volume = this.volume;
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}

/** True if the URL resolves (HEAD 2xx). Uses fetch so a 404 never hits the console. */
async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}
