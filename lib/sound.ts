"use client";

/*
 * Console sound effects, synthesized with Web Audio so there are no files to fetch or cache.
 * The context is created lazily on the first user gesture (browsers block audio before one).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Tone = { freq: number; to?: number; at?: number; dur: number; gain: number; type?: OscillatorType };

function tone({ freq, to, at = 0, dur, gain, type = "square" }: Tone) {
  const ac = audio();
  if (!ac || !master) return;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Short burst of filtered noise: the mechanical part of a click. */
function noise(dur: number, gain: number, hz: number) {
  const ac = audio();
  if (!ac || !master) return;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const env = ac.createGain();
  src.buffer = buf;
  filter.type = "bandpass";
  filter.frequency.value = hz;
  env.gain.value = gain;
  src.connect(filter).connect(env).connect(master);
  src.start();
}

let lastTick = 0;

export const sfx = {
  /** Key / button press. */
  click() {
    noise(0.03, 0.9, 2400);
    tone({ freq: 1800, to: 900, dur: 0.04, gain: 0.08 });
  },
  /** One detent of the thumbwheel. Rate-limited so fast spins don't turn into a buzz. */
  tick() {
    const now = performance.now();
    if (now - lastTick < 28) return;
    lastTick = now;
    noise(0.012, 0.7, 4200);
    tone({ freq: 3200, dur: 0.012, gain: 0.04, type: "triangle" });
  },
  /** Position opened: rising two-note chime. */
  open() {
    tone({ freq: 660, dur: 0.12, gain: 0.12 });
    tone({ freq: 990, at: 0.09, dur: 0.22, gain: 0.12 });
    tone({ freq: 1320, at: 0.09, dur: 0.22, gain: 0.04, type: "triangle" });
  },
  /** Position closed: bright arpeggio on profit, falling notes on loss. */
  close(pnl: number) {
    if (pnl >= 0) {
      [784, 988, 1175, 1568].forEach((freq, i) => tone({ freq, at: i * 0.07, dur: 0.18, gain: 0.1 }));
    } else {
      tone({ freq: 523, dur: 0.16, gain: 0.1 });
      tone({ freq: 392, at: 0.13, dur: 0.16, gain: 0.1 });
      tone({ freq: 330, to: 262, at: 0.26, dur: 0.3, gain: 0.1 });
    }
  },
  /** One step of the bump key charging while held; `progress` 0..1 raises the pitch. */
  charge(progress: number) {
    tone({ freq: 300 + progress * 600, dur: 0.05, gain: 0.05, type: "triangle" });
  },
  /** A press that can't do anything right now: low double buzz. */
  deny() {
    tone({ freq: 180, dur: 0.08, gain: 0.1 });
    tone({ freq: 150, at: 0.1, dur: 0.1, gain: 0.1 });
  },
  /** Price crossed halfway to the profit target. */
  ping() {
    tone({ freq: 1568, dur: 0.1, gain: 0.08, type: "triangle" });
    tone({ freq: 2093, at: 0.08, dur: 0.14, gain: 0.06, type: "triangle" });
  },
  /** Price crossed halfway to the stop loss. */
  warn() {
    tone({ freq: 440, dur: 0.1, gain: 0.08 });
    tone({ freq: 440, at: 0.16, dur: 0.1, gain: 0.08 });
  },
  /** New level reached. */
  levelUp() {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => tone({ freq, at: i * 0.08, dur: 0.16, gain: 0.09 }));
  },
};
