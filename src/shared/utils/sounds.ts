import { isSoundEnabled } from "@/shared/state/audioPreferences";
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
  if (!isSoundEnabled()) return;
  const context = ensureContext();
  if (!context) return;

  const master = context.createGain();
  const baseGain = options?.gain ?? 0.05;
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
          frequency: 820,
          duration: 0.05,
          gain: 0.1,
          attack: 0.0018,
          decay: 0.024,
          release: 0.02,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1200,
          duration: 0.045,
          delay: 0.01,
          gain: 0.065,
          attack: 0.0015,
          decay: 0.022,
          release: 0.018,
        },
      },
    ],
    { gain: 0.04 },
  );
};

export const playSettingsCue = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 940,
          duration: 0.06,
          gain: 0.12,
          attack: 0.0025,
          decay: 0.028,
          release: 0.022,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1350,
          duration: 0.055,
          delay: 0.012,
          gain: 0.075,
          attack: 0.002,
          decay: 0.026,
          release: 0.02,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1750,
          duration: 0.05,
          delay: 0.022,
          gain: 0.06,
          attack: 0.0018,
          decay: 0.024,
          release: 0.02,
        },
      },
    ],
    { gain: 0.05 },
  );
};

export const playWarningCue = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 560,
          duration: 0.07,
          gain: 0.1,
          attack: 0.0035,
          decay: 0.034,
          release: 0.024,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 420,
          duration: 0.075,
          delay: 0.014,
          gain: 0.075,
          attack: 0.0032,
          decay: 0.036,
          release: 0.024,
        },
      },
    ],
    { gain: 0.055 },
  );
};

export const playMiningStart = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 920,
          duration: 0.085,
          gain: 0.12,
          attack: 0.0035,
          decay: 0.04,
          release: 0.028,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1280,
          duration: 0.078,
          delay: 0.012,
          gain: 0.085,
          attack: 0.003,
          decay: 0.036,
          release: 0.028,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1560,
          duration: 0.07,
          delay: 0.022,
          gain: 0.075,
          attack: 0.0025,
          decay: 0.032,
          release: 0.026,
        },
      },
    ],
    { gain: 0.06 },
  );
};

export const playMiningStop = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 640,
          duration: 0.06,
          gain: 0.1,
          attack: 0.0025,
          decay: 0.03,
          release: 0.022,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 460,
          duration: 0.058,
          delay: 0.012,
          gain: 0.065,
          attack: 0.0023,
          decay: 0.028,
          release: 0.022,
        },
      },
    ],
    { gain: 0.045 },
  );
};

export const playMiningComplete = () => {
  playLayers(
    [
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1020,
          duration: 0.07,
          gain: 0.11,
          attack: 0.0028,
          decay: 0.034,
          release: 0.024,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1340,
          duration: 0.072,
          delay: 0.014,
          gain: 0.085,
          attack: 0.0026,
          decay: 0.032,
          release: 0.024,
        },
      },
      {
        kind: "tone",
        spec: {
          type: "sine",
          frequency: 1680,
          duration: 0.07,
          delay: 0.026,
          gain: 0.065,
          attack: 0.0022,
          decay: 0.03,
          release: 0.024,
        },
      },
    ],
    { gain: 0.06 },
  );
};
