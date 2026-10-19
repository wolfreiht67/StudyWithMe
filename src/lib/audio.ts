"use client";

/**
 * Moteur d'ambiances sonores entièrement généré avec la Web Audio API.
 * Aucun fichier audio : pas de question de droits d'auteur et rien à héberger.
 */
import type { AmbianceId } from "./types";

export const AMBIANCES: { id: AmbianceId; name: string; emoji: string; description: string }[] = [
  { id: "pluie", name: "Pluie", emoji: "🌧️", description: "Pluie douce sur la fenêtre" },
  { id: "vagues", name: "Vagues", emoji: "🌊", description: "Ressac lent de l'océan" },
  { id: "bruit-brun", name: "Bruit brun", emoji: "🟤", description: "Bruit grave et enveloppant, idéal pour se couper du monde" },
  { id: "piano", name: "Piano", emoji: "🎹", description: "Notes de piano calmes et espacées" },
  { id: "lofi", name: "Lofi", emoji: "🎧", description: "Accords jazzy et petit beat feutré" },
  { id: "pixel", name: "Pixel calme", emoji: "⛏️", description: "Ambiance jeu vidéo rétro et paisible" },
  { id: "chill", name: "Chill (pause)", emoji: "☁️", description: "Nappes douces pour décompresser" },
  { id: "none", name: "Silence", emoji: "🔇", description: "Pas de son" },
];

type Stop = () => void;
type Generator = (ctx: AudioContext, out: AudioNode, reverb: AudioNode) => Stop;

// ---------- utilitaires ----------

function noiseBuffer(ctx: AudioContext, kind: "white" | "pink" | "brown", seconds = 4): AudioBuffer {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") data[i] = w * 0.5;
      else if (kind === "brown") {
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
  }
  return buf;
}

function loopNoise(ctx: AudioContext, kind: "white" | "pink" | "brown"): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, kind);
  src.loop = true;
  src.start();
  return src;
}

function impulse(ctx: AudioContext, seconds = 3.5, decay = 2.5): AudioBuffer {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Séquenceur à anticipation : appelle cb pour chaque pas, un peu en avance. */
function sequencer(ctx: AudioContext, stepSeconds: number, cb: (time: number, step: number) => void): Stop {
  let next = ctx.currentTime + 0.1;
  let step = 0;
  const id = setInterval(() => {
    while (next < ctx.currentTime + 0.2) {
      cb(next, step++);
      next += stepSeconds;
    }
  }, 25);
  return () => clearInterval(id);
}

/** Note « piano » simple : sinus + triangle avec attaque rapide et longue extinction. */
function pianoNote(ctx: AudioContext, out: AudioNode, midi: number, time: number, vel = 0.3, length = 3) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vel, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, time + length);
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(3000, time);
  f.frequency.exponentialRampToValueAtTime(600, time + length);
  for (const [type, mult, gain] of [["sine", 1, 1], ["triangle", 2, 0.25]] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = midiToHz(midi) * mult;
    const og = ctx.createGain();
    og.gain.value = gain;
    o.connect(og).connect(f);
    o.start(time);
    o.stop(time + length + 0.1);
  }
  f.connect(g).connect(out);
}

// ---------- ambiances ----------

const rain: Generator = (ctx, out) => {
  const nodes: AudioNode[] = [];
  const hiss = loopNoise(ctx, "white");
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 7000;
  const hg = ctx.createGain();
  hg.gain.value = 0.18;
  hiss.connect(hp).connect(lp).connect(hg).connect(out);

  const rumble = loopNoise(ctx, "brown");
  const rl = ctx.createBiquadFilter();
  rl.type = "lowpass";
  rl.frequency.value = 500;
  const rg = ctx.createGain();
  rg.gain.value = 0.35;
  rumble.connect(rl).connect(rg).connect(out);
  nodes.push(hiss, rumble);

  // gouttes individuelles
  const dropBuf = noiseBuffer(ctx, "white", 0.05);
  const id = setInterval(() => {
    const t = ctx.currentTime + Math.random() * 0.05;
    const s = ctx.createBufferSource();
    s.buffer = dropBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500 + Math.random() * 4000;
    bp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15 + Math.random() * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.random() * 2 - 1;
    s.connect(bp).connect(g).connect(p).connect(out);
    s.start(t);
  }, 45);
  return () => {
    clearInterval(id);
    nodes.forEach((n) => (n as AudioBufferSourceNode).stop());
  };
};

const waves: Generator = (ctx, out) => {
  const src = loopNoise(ctx, "pink");
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 600;
  const g = ctx.createGain();
  g.gain.value = 0.4;
  // LFO lent qui fait respirer le filtre et le volume
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 1 / 9;
  const lfoF = ctx.createGain();
  lfoF.gain.value = 450;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.3;
  lfo.connect(lfoF).connect(lp.frequency);
  lfo.connect(lfoG).connect(g.gain);
  lfo.start();
  src.connect(lp).connect(g).connect(out);
  return () => {
    src.stop();
    lfo.stop();
  };
};

const brown: Generator = (ctx, out) => {
  const src = loopNoise(ctx, "brown");
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  const g = ctx.createGain();
  g.gain.value = 0.6;
  src.connect(lp).connect(g).connect(out);
  return () => src.stop();
};

const piano: Generator = (ctx, out, reverb) => {
  // gamme pentatonique de do majeur, plusieurs octaves : toujours harmonieux
  const scale = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
  let timer: ReturnType<typeof setTimeout>;
  const bus = ctx.createGain();
  bus.gain.value = 0.8;
  bus.connect(out);
  bus.connect(reverb);
  const play = () => {
    const t = ctx.currentTime + 0.05;
    const root = pick(scale);
    pianoNote(ctx, bus, root, t, 0.22, 4);
    if (Math.random() < 0.35) pianoNote(ctx, bus, root - 12 >= 36 ? root - 12 : root + 7, t + 0.02, 0.12, 4);
    if (Math.random() < 0.25) pianoNote(ctx, bus, pick(scale), t + 0.4, 0.14, 3.5);
    timer = setTimeout(play, 900 + Math.random() * 2200);
  };
  play();
  return () => clearTimeout(timer);
};

const lofi: Generator = (ctx, out, reverb) => {
  const bpm = 74;
  const eighth = 60 / bpm / 2;
  const chords = [
    [53, 57, 60, 64], // Fmaj7
    [52, 55, 59, 62], // Em7
    [50, 53, 57, 60], // Dm7
    [48, 52, 55, 59], // Cmaj7
  ];
  const bus = ctx.createGain();
  bus.gain.value = 0.9;
  const warm = ctx.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 2200;
  bus.connect(warm).connect(out);
  warm.connect(reverb);
  const noise = noiseBuffer(ctx, "white", 0.3);

  const hit = (time: number, kind: "kick" | "snare" | "hat") => {
    if (kind === "kick") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(120, time);
      o.frequency.exponentialRampToValueAtTime(45, time + 0.15);
      g.gain.setValueAtTime(0.5, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      o.connect(g).connect(bus);
      o.start(time);
      o.stop(time + 0.35);
      return;
    }
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (kind === "snare") {
      f.type = "bandpass";
      f.frequency.value = 1800;
      g.gain.setValueAtTime(0.18, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    } else {
      f.type = "highpass";
      f.frequency.value = 7000;
      g.gain.setValueAtTime(0.05, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    }
    s.connect(f).connect(g).connect(bus);
    s.start(time);
    s.stop(time + 0.25);
  };

  const stopSeq = sequencer(ctx, eighth, (time, step) => {
    const swing = step % 2 === 1 ? eighth * 0.18 : 0;
    const t = time + swing;
    const inBar = step % 8;
    const bar = Math.floor(step / 8);
    const chord = chords[Math.floor(bar / 2) % chords.length];
    if (inBar === 0 && bar % 2 === 0) chord.forEach((n, i) => pianoNote(ctx, bus, n, t + i * 0.025, 0.09, eighth * 15));
    if (inBar === 0) pianoNote(ctx, bus, chord[0] - 12, t, 0.18, eighth * 7);
    if (inBar === 0 || inBar === 5) hit(t, "kick");
    if (inBar === 2 || inBar === 6) hit(t, "snare");
    hit(t, "hat");
    if (Math.random() < 0.18) pianoNote(ctx, bus, pick(chord) + 12, t, 0.07, 1.5);
  });

  // craquement de vinyle
  const crackle = setInterval(() => {
    if (Math.random() > 0.5) return;
    const t = ctx.currentTime + 0.02;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.04 * Math.random(), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);
    s.connect(g).connect(out);
    s.start(t);
    s.stop(t + 0.02);
  }, 120);

  return () => {
    stopSeq();
    clearInterval(crackle);
  };
};

const pixel: Generator = (ctx, out, reverb) => {
  // arpèges carrés très doux, façon jeu vidéo rétro paisible
  const progression = [
    [57, 60, 64, 67], // Am7
    [53, 57, 60, 64], // Fmaj7
    [48, 52, 55, 59], // Cmaj7
    [55, 59, 62, 67], // G
  ];
  const bus = ctx.createGain();
  bus.gain.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1800;
  bus.connect(lp).connect(out);
  lp.connect(reverb);
  const step = 60 / 84 / 2;
  const blip = (midi: number, time: number, len: number, vol: number, type: OscillatorType = "square") => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = midiToHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + len);
    o.connect(g).connect(bus);
    o.start(time);
    o.stop(time + len + 0.05);
  };
  const pattern = [0, 1, 2, 3, 2, 1, 0, -1];
  return sequencer(ctx, step, (time, i) => {
    const chord = progression[Math.floor(i / 16) % progression.length];
    const p = pattern[i % 8];
    if (p >= 0 && Math.random() > 0.15) blip(chord[p] + 12, time, step * 1.6, 0.05);
    if (i % 16 === 0) blip(chord[0] - 12, time, step * 14, 0.12, "triangle");
  });
};

const chill: Generator = (ctx, out, reverb) => {
  const chords = [
    [57, 60, 64, 71], // Am(add9)
    [53, 57, 64, 67], // Fmaj9
    [48, 55, 59, 64], // Cmaj7
    [55, 59, 62, 69], // G6/9
  ];
  const bus = ctx.createGain();
  bus.gain.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  bus.connect(lp).connect(out);
  lp.connect(reverb);
  let idx = 0;
  const playChord = () => {
    const t = ctx.currentTime + 0.05;
    const dur = 8;
    for (const n of chords[idx % chords.length]) {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midiToHz(n);
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.025, t + 2.5);
        g.gain.setValueAtTime(0.025, t + dur - 1);
        g.gain.linearRampToValueAtTime(0, t + dur + 2);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + dur + 2.2);
      }
    }
    pianoNote(ctx, bus, chords[idx % chords.length][3] + 12, t + 1, 0.12, 4);
    idx++;
  };
  playChord();
  const id = setInterval(playChord, 8000);
  return () => clearInterval(id);
};

const GENERATORS: Record<Exclude<AmbianceId, "none">, Generator> = {
  pluie: rain,
  vagues: waves,
  "bruit-brun": brown,
  piano,
  lofi,
  pixel,
  chill,
};

// ---------- moteur ----------

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private current: { id: AmbianceId; gain: GainNode; stop: Stop } | null = null;
  private volume = 0.5;

  private ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = impulse(this.ctx);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.35;
      this.reverb.connect(wet).connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  get playing(): AmbianceId {
    return this.current?.id ?? "none";
  }

  play(id: AmbianceId) {
    if (this.current?.id === id) return;
    this.fadeOutCurrent();
    if (id === "none") return;
    const ctx = this.ensure();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    gain.connect(this.master!);
    const stop = GENERATORS[id](ctx, gain, this.reverb!);
    this.current = { id, gain, stop };
  }

  stop() {
    this.fadeOutCurrent();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  /** Petit carillon de fin de période. */
  chime() {
    const ctx = this.ensure();
    const t = ctx.currentTime + 0.05;
    [76, 79, 84].forEach((n, i) => pianoNote(ctx, this.master!, n, t + i * 0.18, 0.35, 2.5));
  }

  private fadeOutCurrent() {
    if (!this.current || !this.ctx) return;
    const { gain, stop } = this.current;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 1.5);
    setTimeout(() => {
      stop();
      gain.disconnect();
    }, 1700);
    this.current = null;
  }
}

let engine: AmbientEngine | null = null;
export function getEngine(): AmbientEngine {
  if (!engine) engine = new AmbientEngine();
  return engine;
}
