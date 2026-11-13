// Mic loudness only. Audio never leaves the browser: we measure how loud you
// are a few times a second and share that number so your bean's mouth flaps.

export class Mic {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private timer = 0;
  private level = 0;
  private sent = 0;
  private quietFor = 0;
  /** Called with 0..1 whenever the shared level should change. */
  onLevel: (level: number) => void = () => {};
  /** Called every tick with the raw smoothed level, for the button glow. */
  onMeter: (level: number) => void = () => {};

  get on() { return !!this.stream; }

  async start() {
    if (this.stream) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.stream = stream;
    const ctx = new AudioContext();
    this.ctx = ctx;
    // browsers start audio suspended until a click; resume on the next one
    if (ctx.state === "suspended") {
      const wake = () => { ctx.resume(); window.removeEventListener("pointerdown", wake); };
      window.addEventListener("pointerdown", wake);
      ctx.resume().catch(() => {});
    }
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser); // not connected to the speakers: we only listen
    const buf = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      // noise gate + rough voice range
      const raw = Math.min(1, Math.max(0, (rms - 0.012) / 0.09));
      this.level += (raw - this.level) * (raw > this.level ? 0.7 : 0.35);
      this.onMeter(this.level);
      const q = this.level < 0.05 ? 0 : Math.round(this.level * 20) / 20;
      this.quietFor = q === 0 ? this.quietFor + 1 : 0;
      // send changes only; one zero when you go quiet
      if (q !== this.sent && (q > 0 || this.quietFor >= 2)) {
        this.sent = q;
        this.onLevel(q);
      }
    };
    this.timer = window.setInterval(tick, 80);
  }

  stop() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.level = 0;
    this.onMeter(0);
    if (this.sent !== 0) { this.sent = 0; this.onLevel(0); }
  }
}
