export type BoostStackPolicy = "stack" | "extend" | "replace";

export type SessionMultiplierEffect = {
  kind: "session-multiplier";
  factor: number;
  sessions: number;
  stackPolicy?: BoostStackPolicy;
};

export type TimedMultiplierEffect = {
  kind: "timed-multiplier";
  factor: number;
  durationMs: number;
  stackPolicy?: BoostStackPolicy;
};

export type AutoCollectEffect = {
  kind: "auto-collect";
  durationMs: number;
  stackPolicy?: BoostStackPolicy;
};

export type InstantGoldEffect = {
  kind: "instant-gold";
  goldRange: {
    min: number;
    max: number;
  };
  precision?: number;
};

export type BoostEffectConfig =
  | SessionMultiplierEffect
  | TimedMultiplierEffect
  | AutoCollectEffect
  | InstantGoldEffect;

export type BoostActivationMeta = {
  name: string;
  icon?: string;
  itemId?: string;
  description?: string;
};
