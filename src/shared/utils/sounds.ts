import { isSoundEnabled } from "@/shared/state/audioPreferences";

type FilterShape = {
  type?: BiquadFilterType;
  frequency: number;
  Q?: number;
  gain?: number;
};

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
  filter?: FilterShape;
};

type NoiseShape = {
  duration: number;
  delay?: number;
  gain: number;
  filter?: FilterShape;
};

type Layer = { kind: "tone"; spec: ToneShape } | { kind: "noise"; spec: NoiseShape };

type SoundPreset = {
  layers: readonly Layer[];
  gain?: number;
};

type FilterConnection = {
  output: AudioNode;
  filter: BiquadFilterNode | null;
};

type PannerConnection = {
  output: AudioNode;
  panner: StereoPannerNode | null;
};

type PlaybackOptions = {
  gain?: number;
};

let audioContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

const MIN_GAIN = 0.0001;
const MIN_PEAK_GAIN = 0.001;
const DEFAULT_MASTER_GAIN = 0.05;
const TONE_DEFAULTS = {
  attack: 0.01,
  decay: 0.12,
  release: 0.2,
  sustainRatio: 0.6,
  stopPadding: 0.06,
};
const NOISE_DEFAULTS = {
  attack: 0.005,
  release: 0.22,
  stopPadding: 0.05,
};
const MASTER_RELEASE_PADDING = 0.08;
const CLEANUP_EXTRA_MS = 20;
const MASTER_CLEANUP_EXTRA_MS = 80;
const NOISE_BUFFER_DURATION = 0.35;

const scheduleCleanup = (
  context: AudioContext,
  stopTime: number,
  cleanup: () => void,
  extraDelayMs = CLEANUP_EXTRA_MS,
) => {
  const cleanupDelay = Math.max(0, stopTime - context.currentTime);
  window.setTimeout(cleanup, cleanupDelay * 1000 + extraDelayMs);
};

const cleanupAudioNodes = (...nodes: Array<AudioNode | null | undefined>) => {
  nodes.forEach((node) => {
    if (node) {
      node.disconnect();
    }
  });
};

const connectWithOptionalFilter = (
  context: AudioContext,
  node: AudioNode,
  filterSpec: FilterShape | undefined,
  start: number,
  defaultType: BiquadFilterType,
): FilterConnection => {
  if (!filterSpec) {
    return { output: node, filter: null };
  }
  const filter = context.createBiquadFilter();
  filter.type = filterSpec.type ?? defaultType;
  filter.frequency.setValueAtTime(filterSpec.frequency, start);
  if (typeof filterSpec.Q === "number") {
    filter.Q.setValueAtTime(filterSpec.Q, start);
  }
  if (typeof filterSpec.gain === "number") {
    filter.gain.setValueAtTime(filterSpec.gain, start);
  }
  node.connect(filter);
  return { output: filter, filter };
};

const connectWithOptionalPanner = (
  context: AudioContext,
  node: AudioNode,
  start: number,
  pan?: number,
): PannerConnection => {
  if (typeof pan !== "number" || !("createStereoPanner" in context)) {
    return { output: node, panner: null };
  }
  const panner = context.createStereoPanner();
  panner.pan.setValueAtTime(pan, start);
  node.connect(panner);
  return { output: panner, panner };
};

const tone = (spec: ToneShape): Layer => ({ kind: "tone", spec });

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
  const duration = NOISE_BUFFER_DURATION;
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
  const attack = shape.attack ?? TONE_DEFAULTS.attack;
  const decay = shape.decay ?? TONE_DEFAULTS.decay;
  const release = shape.release ?? TONE_DEFAULTS.release;
  const sustainLevel = shape.gain * TONE_DEFAULTS.sustainRatio;

  gainNode.gain.setValueAtTime(MIN_GAIN, start);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(shape.gain, MIN_PEAK_GAIN), start + attack);
  gainNode.gain.exponentialRampToValueAtTime(
    Math.max(sustainLevel, MIN_GAIN),
    start + attack + decay,
  );
  gainNode.gain.exponentialRampToValueAtTime(MIN_GAIN, start + shape.duration + release);

  const { output: filteredNode, filter } = connectWithOptionalFilter(
    context,
    gainNode,
    shape.filter,
    start,
    "lowpass",
  );
  const { output: routedNode, panner } = connectWithOptionalPanner(
    context,
    filteredNode,
    start,
    shape.pan,
  );

  routedNode.connect(destination);

  oscillator.connect(gainNode);
  oscillator.start(start);
  const stopTime = start + shape.duration + release + TONE_DEFAULTS.stopPadding;
  oscillator.stop(stopTime);

  scheduleCleanup(context, stopTime, () => {
    oscillator.disconnect();
    cleanupAudioNodes(gainNode, filter, panner);
  });

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
  const attack = NOISE_DEFAULTS.attack;
  const release = NOISE_DEFAULTS.release;

  gainNode.gain.setValueAtTime(MIN_GAIN, start);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(shape.gain, MIN_PEAK_GAIN), start + attack);
  gainNode.gain.exponentialRampToValueAtTime(MIN_GAIN, start + shape.duration + release);

  const { output: routedNode, filter } = connectWithOptionalFilter(
    context,
    gainNode,
    shape.filter,
    start,
    "bandpass",
  );

  routedNode.connect(destination);
  bufferSource.connect(gainNode);
  bufferSource.start(start);
  const stopTime = start + shape.duration + release + NOISE_DEFAULTS.stopPadding;
  bufferSource.stop(stopTime);

  scheduleCleanup(context, stopTime, () => {
    bufferSource.disconnect();
    cleanupAudioNodes(gainNode, filter);
  });

  return stopTime;
};

const playLayers = (layers: readonly Layer[], options?: PlaybackOptions) => {
  if (!isSoundEnabled()) return;
  const context = ensureContext();
  if (!context) return;

  const master = context.createGain();
  const baseGain = options?.gain ?? DEFAULT_MASTER_GAIN;
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
  master.gain.exponentialRampToValueAtTime(MIN_GAIN, longest + MASTER_RELEASE_PADDING);

  scheduleCleanup(
    context,
    longest,
    () => {
      master.disconnect();
    },
    MASTER_CLEANUP_EXTRA_MS,
  );
};

type SoundPresetKey =
  | "navTap"
  | "settingsCue"
  | "warningCue"
  | "miningStart"
  | "miningStop"
  | "miningComplete";

const SOUND_PRESETS: Record<SoundPresetKey, SoundPreset> = {
  navTap: {
    gain: 0.04,
    layers: [
      tone({
        frequency: 820,
        duration: 0.05,
        gain: 0.1,
        attack: 0.0018,
        decay: 0.024,
        release: 0.02,
      }),
      tone({
        frequency: 1200,
        duration: 0.045,
        delay: 0.01,
        gain: 0.065,
        attack: 0.0015,
        decay: 0.022,
        release: 0.018,
      }),
    ],
  },
  settingsCue: {
    gain: 0.05,
    layers: [
      tone({
        frequency: 940,
        duration: 0.06,
        gain: 0.12,
        attack: 0.0025,
        decay: 0.028,
        release: 0.022,
      }),
      tone({
        frequency: 1350,
        duration: 0.055,
        delay: 0.012,
        gain: 0.075,
        attack: 0.002,
        decay: 0.026,
        release: 0.02,
      }),
      tone({
        frequency: 1750,
        duration: 0.05,
        delay: 0.022,
        gain: 0.06,
        attack: 0.0018,
        decay: 0.024,
        release: 0.02,
      }),
    ],
  },
  warningCue: {
    gain: 0.055,
    layers: [
      tone({
        frequency: 560,
        duration: 0.07,
        gain: 0.1,
        attack: 0.0035,
        decay: 0.034,
        release: 0.024,
      }),
      tone({
        frequency: 420,
        duration: 0.075,
        delay: 0.014,
        gain: 0.075,
        attack: 0.0032,
        decay: 0.036,
        release: 0.024,
      }),
    ],
  },
  miningStart: {
    gain: 0.06,
    layers: [
      tone({
        frequency: 920,
        duration: 0.085,
        gain: 0.12,
        attack: 0.0035,
        decay: 0.04,
        release: 0.028,
      }),
      tone({
        frequency: 1280,
        duration: 0.078,
        delay: 0.012,
        gain: 0.085,
        attack: 0.003,
        decay: 0.036,
        release: 0.028,
      }),
      tone({
        frequency: 1560,
        duration: 0.07,
        delay: 0.022,
        gain: 0.075,
        attack: 0.0025,
        decay: 0.032,
        release: 0.026,
      }),
    ],
  },
  miningStop: {
    gain: 0.045,
    layers: [
      tone({
        frequency: 640,
        duration: 0.06,
        gain: 0.1,
        attack: 0.0025,
        decay: 0.03,
        release: 0.022,
      }),
      tone({
        frequency: 460,
        duration: 0.058,
        delay: 0.012,
        gain: 0.065,
        attack: 0.0023,
        decay: 0.028,
        release: 0.022,
      }),
    ],
  },
  miningComplete: {
    gain: 0.06,
    layers: [
      tone({
        frequency: 1020,
        duration: 0.07,
        gain: 0.11,
        attack: 0.0028,
        decay: 0.034,
        release: 0.024,
      }),
      tone({
        frequency: 1340,
        duration: 0.072,
        delay: 0.014,
        gain: 0.085,
        attack: 0.0026,
        decay: 0.032,
        release: 0.024,
      }),
      tone({
        frequency: 1680,
        duration: 0.07,
        delay: 0.026,
        gain: 0.065,
        attack: 0.0022,
        decay: 0.03,
        release: 0.024,
      }),
    ],
  },
};

const playPreset = (key: SoundPresetKey) => {
  const { layers, gain } = SOUND_PRESETS[key];
  playLayers(layers, gain !== undefined ? { gain } : undefined);
};

export const playNavTap = () => playPreset("navTap");
export const playSettingsCue = () => playPreset("settingsCue");
export const playWarningCue = () => playPreset("warningCue");
export const playMiningStart = () => playPreset("miningStart");
export const playMiningStop = () => playPreset("miningStop");
export const playMiningComplete = () => playPreset("miningComplete");
