// Mic loudness only. Audio never leaves the browser: we measure how loud you
// are a few times a second and share that number so your bean's mouth flaps.

/** Asking for permission, listening, or not. */
export type MicStatus = "off" | "starting" | "on" | "denied";
export type MicEvent = "start" | "granted" | "refused" | "stop";

/** The mic's rules: one permission request at a time, and a stop while asking wins. */
export function nextMicStatus(s: MicStatus, e: MicEvent): MicStatus {
  switch (e) {
    case "start":
      return s === "off" || s === "denied" ? "starting" : s;
    case "granted":
      return s === "starting" ? "on" : s;
    case "refused":
      return s === "starting" ? "denied" : s;
    case "stop":
      return "off";
    default:
      return e satisfies never;
  }
}

/** A live microphone: how loud it is right now (RMS), and how to let it go. */
export interface MicInput {
  rms(): number;
  close(): void;
}

export interface Mic {
  readonly status: MicStatus;
  /** Asks for the mic and starts listening. Rejects if permission is refused. */
  start(): Promise<void>;
  stop(): void;
  /** Called with 0..1 whenever the shared level should change. */
  onLevel: (level: number) => void;
  /** Called every tick with the raw smoothed level, for the button glow. */
  onMeter: (level: number) => void;
  onStatus: (status: MicStatus) => void;
}

/** `open` gets a microphone; tests pass a fake. */
export function createMic(open: () => Promise<MicInput> = browserMic): Mic {
  let status: MicStatus = "off";
  let input: MicInput | null = null;
  /** Which permission request is current. A stop or a newer start makes older ones stale. */
  let asking = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let level = 0;
  let sent = 0;
  let quietFor = 0;

  /** Applies `e`; false when it changed nothing. Callers announce the change once they're done. */
  const move = (e: MicEvent) => {
    const next = nextMicStatus(status, e);
    if (next === status) return false;
    status = next;
    return true;
  };

  const tick = () => {
    if (!input) return;
    // noise gate + rough voice range
    const raw = Math.min(1, Math.max(0, (input.rms() - 0.012) / 0.09));
    level += (raw - level) * (raw > level ? 0.7 : 0.35);
    mic.onMeter(level);
    const q = level < 0.05 ? 0 : Math.round(level * 20) / 20;
    quietFor = q === 0 ? quietFor + 1 : 0;
    // send changes only; one zero when you go quiet
    if (q !== sent && (q > 0 || quietFor >= 2)) {
      sent = q;
      mic.onLevel(q);
    }
  };

  const mic: Mic = {
    get status() {
      return status;
    },
    onLevel: () => {},
    onMeter: () => {},
    onStatus: () => {},

    async start() {
      if (!move("start")) return;
      const mine = ++asking;
      mic.onStatus(status);
      // whoever heard "starting" may have stopped it already
      if (mine !== asking) return;
      let got: MicInput;
      try {
        got = await open();
      } catch (e) {
        if (mine === asking && move("refused")) {
          mic.onStatus(status);
          throw e;
        }
        return;
      }
      // stopped (or asked again) while the browser was asking: let this one go
      if (mine !== asking) {
        got.close();
        return;
      }
      input = got;
      timer = setInterval(tick, 80);
      move("granted");
      mic.onStatus(status);
    },

    stop() {
      asking++;
      clearInterval(timer);
      input?.close();
      input = null;
      level = 0;
      mic.onMeter(0);
      if (sent !== 0) {
        sent = 0;
        mic.onLevel(0);
      }
      if (move("stop")) mic.onStatus(status);
    },
  };
  return mic;
}

/** The browser's microphone, measured with an analyser that isn't connected to the speakers. */
async function browserMic(): Promise<MicInput> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  // browsers start audio suspended until a click; resume on the next one
  if (ctx.state === "suspended") {
    const wake = () => {
      ctx.resume();
      window.removeEventListener("pointerdown", wake);
    };
    window.addEventListener("pointerdown", wake);
    ctx.resume().catch(() => {});
  }
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser); // not connected to the speakers: we only listen
  const buf = new Float32Array(analyser.fftSize);
  return {
    rms() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      return Math.sqrt(sum / buf.length);
    },
    close() {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}
