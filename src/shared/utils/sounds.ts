type ToneShape = {
  frequency: number;
  frequencyEnd?: number;
  duration: number;
  delay?: number;
  gain: number;
  attack?: number;
  decay?: number;
  release?: number;
  type?: OscillatorType;
  detune?: number;
  pan?: number;
  filter?: {
    type?: BiquadFilterType;
    frequency: number;
    Q?: number;
    gain?: number;
  };
};

type NoiseShape = {
  duration: number;
  delay?: number;
  gain: number;
  filter?: {
    type?: BiquadFilterType;
    frequency: number;
    Q?: number;
  };
};

type Layer = { kind: "tone"; spec: ToneShape } | { kind: "noise"; spec: NoiseShape };

type PlaybackOptions = {
  gain?: number;
};

let audioContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

const ensureContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) {
    audioContext = new AudioCtor();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => undefined);
  }
  return audioContext;
};

const getNoiseBuffer = (context: AudioContext) => {
  if (noiseBuffer) return noiseBuffer;
  const duration = 0.35;
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const fade = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  noiseBuffer = buffer;
  return buffer;
};

const scheduleTone = (
  context: AudioContext,
  destination: AudioNode,
  baseTime: number,
  shape: ToneShape,
): number => {
  const oscillator = context.createOscillator();
  oscillator.type = shape.type ?? "sine";
  oscillator.frequency.setValueAtTime(shape.frequency, baseTime);
  if (shape.frequencyEnd && shape.frequencyEnd > 0) {
    const curveTime = baseTime + shape.duration;
    oscillator.frequency.exponentialRampToValueAtTime(shape.frequencyEnd, curveTime);
  }
  if (typeof shape.detune === "number") {
    oscillator.detune.setValueAtTime(shape.detune, baseTime);
  }

  const gainNode = context.createGain();
  const start = baseTime + (shape.delay ?? 0);
  const attack = shape.attack ?? 0.01;
  const decay = shape.decay ?? 0.12;
  const release = shape.release ?? 0.2;
  const sustainLevel = shape.gain * 0.6;

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(shape.gain, 0.001), start + attack);
  gainNode.gain.exponentialRampToValueAtTime(
    Math.max(sustainLevel, 0.0001),
    start + attack + decay,
  );
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + shape.duration + release);

  let outputNode: AudioNode = gainNode;
  if (shape.filter) {
    const filter = context.createBiquadFilter();
    filter.type = shape.filter.type ?? "lowpass";
    filter.frequency.setValueAtTime(shape.filter.frequency, start);
    if (typeof shape.filter.Q === "number") {
      filter.Q.setValueAtTime(shape.filter.Q, start);
    }
    if (typeof shape.filter.gain === "number" && "gain" in filter) {
      filter.gain.setValueAtTime(shape.filter.gain, start);
    }
    gainNode.connect(filter);
    outputNode = filter;
  }

  if (typeof shape.pan === "number" && "createStereoPanner" in context) {
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(shape.pan, start);
    outputNode.connect(panner);
    panner.connect(destination);
  } else {
    outputNode.connect(destination);
  }

  oscillator.connect(gainNode);
  oscillator.start(start);
  const stopTime = start + shape.duration + release + 0.06;
  oscillator.stop(stopTime);

  const cleanupDelay = Math.max(0, stopTime - context.currentTime);
  window.setTimeout(
    () => {
      oscillator.disconnect();
      gainNode.disconnect();
      if (outputNode !== gainNode) {
        outputNode.disconnect?.();
      }
    },
    cleanupDelay * 1000 + 20,
  );

  return stopTime;
};

const scheduleNoise = (
  context: AudioContext,
  destination: AudioNode,
  baseTime: number,
  shape: NoiseShape,
): number => {
  const bufferSource = context.createBufferSource();
  bufferSource.buffer = getNoiseBuffer(context);
  bufferSource.loop = false;

  const gainNode = context.createGain();
  const start = baseTime + (shape.delay ?? 0);
  const attack = 0.005;
  const release = 0.22;

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(shape.gain, 0.001), start + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + shape.duration + release);

  let outputNode: AudioNode = gainNode;
  if (shape.filter) {
    const filter = context.createBiquadFilter();
    filter.type = shape.filter.type ?? "bandpass";
    filter.frequency.setValueAtTime(shape.filter.frequency, start);
    if (typeof shape.filter.Q === "number") {
      filter.Q.setValueAtTime(shape.filter.Q, start);
    }
    gainNode.connect(filter);
    outputNode = filter;
  }

  outputNode.connect(destination);
  bufferSource.connect(gainNode);
  bufferSource.start(start);
  const stopTime = start + shape.duration + release + 0.05;
  bufferSource.stop(stopTime);

  const cleanupDelay = Math.max(0, stopTime - context.currentTime);
  window.setTimeout(
    () => {
      bufferSource.disconnect();
      gainNode.disconnect();
      if (outputNode !== gainNode) {
        outputNode.disconnect?.();
      }
    },
    cleanupDelay * 1000 + 20,
  );

  return stopTime;
};

const playLayers = (layers: Layer[], options?: PlaybackOptions) => {
  const context = ensureContext();
  if (!context) return;

  const master = context.createGain();
  const baseGain = options?.gain ?? 0.22;
  master.gain.value = baseGain;
  master.connect(context.destination);

  const now = context.currentTime;
  let longest = now;

  layers.forEach((layer) => {
    const stopTime =
      layer.kind === "tone"
        ? scheduleTone(context, master, now, layer.spec)
        : scheduleNoise(context, master, now, layer.spec);
    if (stopTime > longest) {
      longest = stopTime;
    }
  });

  master.gain.setValueAtTime(baseGain, now);
  master.gain.exponentialRampToValueAtTime(0.0001, longest + 0.08);

  const cleanupDelay = Math.max(0, longest - now);
  window.setTimeout(
    () => {
      master.disconnect();
    },
    cleanupDelay * 1000 + 80,
  );
};

export const playNavTap = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 800,
          duration: 0.045,
          gain: 0.32,
          attack: 0.002,
          decay: 0.025,
          release: 0.018,
        },
      },
      {
        kind: "noise",
        spec: {
          duration: 0.035,
          gain: 0.12,
          filter: { type: "highpass", frequency: 4000, Q: 1.2 },
        },
      },
    ],
    { gain: 0.14 },
  );
};

export const playSettingsCue = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1200,
          duration: 0.055,
          gain: 0.28,
          attack: 0.003,
          decay: 0.03,
          release: 0.022,
        },
      },
      {
        kind: "noise",
        spec: {
          duration: 0.04,
          delay: 0.008,
          gain: 0.1,
          filter: { type: "bandpass", frequency: 3500, Q: 2.5 },
        },
      },
    ],
    { gain: 0.16 },
  );
};

export const playWarningCue = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 600,
          duration: 0.065,
          gain: 0.26,
          attack: 0.004,
          decay: 0.035,
          release: 0.026,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 450,
          duration: 0.07,
          delay: 0.012,
          gain: 0.18,
          attack: 0.004,
          decay: 0.04,
          release: 0.026,
        },
      },
    ],
    { gain: 0.18 },
  );
};

export const playMiningStart = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1000,
          duration: 0.08,
          gain: 0.34,
          attack: 0.004,
          decay: 0.045,
          release: 0.031,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1400,
          duration: 0.075,
          delay: 0.015,
          gain: 0.22,
          attack: 0.003,
          decay: 0.042,
          release: 0.03,
        },
      },
      {
        kind: "noise",
        spec: {
          duration: 0.05,
          delay: 0.01,
          gain: 0.08,
          filter: { type: "highpass", frequency: 5000, Q: 1.5 },
        },
      },
    ],
    { gain: 0.2 },
  );
};

export const playMiningStop = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 700,
          duration: 0.055,
          gain: 0.28,
          attack: 0.003,
          decay: 0.032,
          release: 0.02,
        },
      },
      {
        kind: "noise",
        spec: {
          duration: 0.04,
          delay: 0.006,
          gain: 0.08,
          filter: { type: "highpass", frequency: 4500, Q: 1.3 },
        },
      },
    ],
    { gain: 0.15 },
  );
};

export const playMiningComplete = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1100,
          duration: 0.065,
          gain: 0.32,
          attack: 0.003,
          decay: 0.038,
          release: 0.024,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1500,
          duration: 0.07,
          delay: 0.012,
          gain: 0.24,
          attack: 0.003,
          decay: 0.042,
          release: 0.025,
        },
      },
      {
        kind: "noise",
        spec: {
          duration: 0.045,
          delay: 0.015,
          gain: 0.1,
          filter: { type: "bandpass", frequency: 4200, Q: 2.8 },
        },
      },
    ],
    { gain: 0.2 },
  );
};
