/**
 * Boosts State Management
 * 
 * Comprehensive boost system for mining multipliers and auto-collect features.
 * 
 * Boost Types:
 * - Session Multipliers: Increase rewards for N sessions
 * - Timed Multipliers: Increase rewards for duration
 * - Auto-Collect: Passive reward collection
 * - Instant Gold: Immediate random GOLD reward
 * 
 * Stack Policies:
 * - stack: Multiple boosts stack additively
 * - extend: Extends existing boost duration
 * - replace: Replaces existing boost
 * 
 * Features:
 * - Automatic expiration cleanup
 * - Session consumption tracking
 * - Multiple multipliers combine multiplicatively
 * - React integration with useSyncExternalStore
 * 
 * @module shared/state/boosts
 */

import { useSyncExternalStore } from "react";
import type { BoostActivationMeta, BoostEffectConfig } from "@/shared/types/boosts";

export type BoostKind = "session" | "timed" | "auto-collect";

export type SessionMultiplierInput = {
  id: string;
  name: string;
  factor: number;
  sessions: number;
  activatedAt?: number;
  originItemId?: string;
  icon?: string;
  description?: string;
};

export type TimedMultiplierInput = {
  id: string;
  name: string;
  factor: number;
  expiresAt: number;
  activatedAt?: number;
  originItemId?: string;
  icon?: string;
  description?: string;
};

export type AutoCollectInput = {
  id: string;
  name: string;
  expiresAt: number;
  activatedAt?: number;
  originItemId?: string;
  icon?: string;
  description?: string;
};

export type MultiplierBoost = {
  id: string;
  name: string;
  factor: number;
  kind: "session" | "timed";
  activatedAt: number;
  originItemId?: string;
  icon?: string;
  description?: string;
  sessionsRemaining?: number;
  expiresAt?: number;
};

export type AutoCollectBoost = {
  id: string;
  name: string;
  kind: "auto-collect";
  activatedAt: number;
  expiresAt: number;
  originItemId?: string;
  icon?: string;
  description?: string;
};

export type ActiveBoost = MultiplierBoost | AutoCollectBoost;

export type BoostsState = {
  multipliers: MultiplierBoost[];
  autoCollect: AutoCollectBoost | null;
};

export type SessionActivationResult = {
  kind: "session-multiplier";
  id: string;
  factor: number;
  sessionsRemaining: number;
};

export type TimedActivationResult = {
  kind: "timed-multiplier";
  id: string;
  factor: number;
  expiresAt: number;
  extended: boolean;
};

export type AutoCollectActivationResult = {
  kind: "auto-collect";
  id: string;
  expiresAt: number;
  extended: boolean;
};

export type InstantGoldActivationResult = {
  kind: "instant-gold";
  goldAwarded: number;
  precision: number;
};

export type BoostActivationResult =
  | SessionActivationResult
  | TimedActivationResult
  | AutoCollectActivationResult
  | InstantGoldActivationResult;

const initialState: BoostsState = {
  multipliers: [],
  autoCollect: null,
};

let state: BoostsState = { ...initialState };

const listeners = new Set<() => void>();
let tickRef: number | null = null;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function cleanupExpired(now = Date.now()) {
  state.multipliers = state.multipliers.filter((boost) => {
    if (typeof boost.expiresAt === "number" && boost.expiresAt <= now) return false;
    if (
      boost.kind === "session" &&
      typeof boost.sessionsRemaining === "number" &&
      boost.sessionsRemaining <= 0
    ) {
      return false;
    }
    return true;
  });

  if (state.autoCollect && state.autoCollect.expiresAt <= now) {
    state = { ...state, autoCollect: null };
  }
}

function generateBoostId(prefix: string, now = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${now.toString(36)}-${rand}`;
}

function addSessionMultiplierEntry(input: SessionMultiplierInput): MultiplierBoost {
  const now = input.activatedAt ?? Date.now();
  const sessions = Math.max(1, Math.floor(input.sessions));
  const boost: MultiplierBoost = {
    id: input.id,
    name: input.name,
    factor: input.factor,
    kind: "session",
    activatedAt: now,
    originItemId: input.originItemId,
    icon: input.icon,
    description: input.description,
    sessionsRemaining: sessions,
  };
  state = {
    ...state,
    multipliers: [...state.multipliers, boost],
  };
  emit();
  return boost;
}

function addTimedMultiplierEntry(input: TimedMultiplierInput): MultiplierBoost {
  const now = input.activatedAt ?? Date.now();
  const expiresAt = Math.max(now, input.expiresAt);
  const boost: MultiplierBoost = {
    id: input.id,
    name: input.name,
    factor: input.factor,
    kind: "timed",
    activatedAt: now,
    originItemId: input.originItemId,
    icon: input.icon,
    description: input.description,
    expiresAt,
  };
  state = {
    ...state,
    multipliers: [...state.multipliers, boost],
  };
  emit();
  return boost;
}

function enableAutoCollectEntry(input: AutoCollectInput): AutoCollectBoost {
  const now = input.activatedAt ?? Date.now();
  const expiresAt = Math.max(now, input.expiresAt);
  const entry: AutoCollectBoost = {
    id: input.id,
    name: input.name,
    kind: "auto-collect",
    activatedAt: now,
    expiresAt,
    originItemId: input.originItemId,
    icon: input.icon,
    description: input.description,
  };

  state = {
    ...state,
    autoCollect: entry,
  };
  emit();
  return entry;
}

function isSameOrigin(
  boost: MultiplierBoost | AutoCollectBoost,
  meta: BoostActivationMeta,
): boolean {
  if (!meta.itemId) return false;
  return boost.originItemId === meta.itemId;
}

export const boostsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (tickRef == null && typeof window !== "undefined") {
      tickRef = window.setInterval(() => {
        const before = JSON.stringify({
          multipliers: state.multipliers,
          autoCollect: state.autoCollect,
        });
        cleanupExpired();
        const after = JSON.stringify({
          multipliers: state.multipliers,
          autoCollect: state.autoCollect,
        });
        if (before !== after) emit();
      }, 30_000);
    }
    return () => listeners.delete(listener);
  },
  getSnapshot(): BoostsState {
    cleanupExpired();
    return state;
  },
  getServerSnapshot(): BoostsState {
    return state;
  },
  addSessionMultiplier(input: SessionMultiplierInput) {
    return addSessionMultiplierEntry(input);
  },
  addTimedMultiplier(input: TimedMultiplierInput) {
    return addTimedMultiplierEntry(input);
  },
  enableAutoCollect(input: AutoCollectInput) {
    return enableAutoCollectEntry(input);
  },
  consumeSession() {
    let changed = false;
    state = {
      ...state,
      multipliers: state.multipliers.map((boost) => {
        if (boost.kind !== "session") return boost;
        if (typeof boost.sessionsRemaining !== "number") return boost;
        changed = true;
        const nextSessions = Math.max(0, boost.sessionsRemaining - 1);
        return { ...boost, sessionsRemaining: nextSessions };
      }),
    };
    cleanupExpired();
    if (changed) emit();
  },
  clearAll() {
    state = { ...initialState };
    emit();
  },
  activateBoost(effect: BoostEffectConfig, meta: BoostActivationMeta): BoostActivationResult {
    const now = Date.now();

    switch (effect.kind) {
      case "session-multiplier": {
        const id = generateBoostId("session", now);
        const sessions = Math.max(1, Math.floor(effect.sessions));
        const boost = addSessionMultiplierEntry({
          id,
          name: meta.name,
          factor: effect.factor,
          sessions,
          activatedAt: now,
          originItemId: meta.itemId,
          icon: meta.icon,
          description: meta.description,
        });
        return {
          kind: "session-multiplier",
          id: boost.id,
          factor: boost.factor,
          sessionsRemaining: boost.sessionsRemaining ?? sessions,
        };
      }
      case "timed-multiplier": {
        const policy = effect.stackPolicy ?? "stack";
        const duration = Math.max(0, effect.durationMs);

        if (policy === "extend" && meta.itemId) {
          const existing = state.multipliers.find(
            (boost) => boost.kind === "timed" && isSameOrigin(boost, meta),
          );
          if (existing) {
            const remaining = Math.max(0, (existing.expiresAt ?? now) - now);
            const expiresAt = now + remaining + duration;
            const updated: MultiplierBoost = {
              ...existing,
              expiresAt,
              activatedAt: now,
              originItemId: meta.itemId,
              icon: meta.icon ?? existing.icon,
              description: meta.description ?? existing.description,
              name: meta.name,
            };
            state = {
              ...state,
              multipliers: state.multipliers.map((boost) =>
                boost.id === existing.id ? updated : boost,
              ),
            };
            emit();
            return {
              kind: "timed-multiplier",
              id: updated.id,
              factor: updated.factor,
              expiresAt: updated.expiresAt ?? expiresAt,
              extended: true,
            };
          }
        }

        if (policy === "replace" && meta.itemId) {
          const filtered = state.multipliers.filter(
            (boost) => !(boost.kind === "timed" && isSameOrigin(boost, meta)),
          );
          if (filtered.length !== state.multipliers.length) {
            state = { ...state, multipliers: filtered };
          }
        }

        const id = generateBoostId("timed", now);
        const expiresAt = now + duration;
        const boost = addTimedMultiplierEntry({
          id,
          name: meta.name,
          factor: effect.factor,
          expiresAt,
          activatedAt: now,
          originItemId: meta.itemId,
          icon: meta.icon,
          description: meta.description,
        });
        return {
          kind: "timed-multiplier",
          id: boost.id,
          factor: boost.factor,
          expiresAt: boost.expiresAt ?? expiresAt,
          extended: false,
        };
      }
      case "auto-collect": {
        const policy = effect.stackPolicy ?? "extend";
        const duration = Math.max(0, effect.durationMs);

        if (
          policy === "extend" &&
          state.autoCollect &&
          (!meta.itemId || isSameOrigin(state.autoCollect, meta))
        ) {
          const remaining = Math.max(0, state.autoCollect.expiresAt - now);
          const expiresAt = now + remaining + duration;
          const updated: AutoCollectBoost = {
            ...state.autoCollect,
            expiresAt,
            activatedAt: now,
            originItemId: meta.itemId ?? state.autoCollect.originItemId,
            icon: meta.icon ?? state.autoCollect.icon,
            description: meta.description ?? state.autoCollect.description,
            name: meta.name,
          };
          state = { ...state, autoCollect: updated };
          emit();
          return {
            kind: "auto-collect",
            id: updated.id,
            expiresAt: updated.expiresAt,
            extended: true,
          };
        }

        if (
          policy === "replace" &&
          state.autoCollect &&
          (!meta.itemId || isSameOrigin(state.autoCollect, meta))
        ) {
          state = { ...state, autoCollect: null };
        }

        const id = generateBoostId("auto", now);
        const expiresAt = now + duration;
        const entry = enableAutoCollectEntry({
          id,
          name: meta.name,
          expiresAt,
          activatedAt: now,
          originItemId: meta.itemId,
          icon: meta.icon,
          description: meta.description,
        });
        return {
          kind: "auto-collect",
          id: entry.id,
          expiresAt: entry.expiresAt,
          extended: false,
        };
      }
      case "instant-gold": {
        const precision = typeof effect.precision === "number" ? Math.max(0, effect.precision) : 3;
        const min = Math.min(effect.goldRange.min, effect.goldRange.max);
        const max = Math.max(effect.goldRange.min, effect.goldRange.max);
        const value = min + Math.random() * (max - min);
        const goldAwarded = Number(value.toFixed(precision));
        return {
          kind: "instant-gold",
          goldAwarded,
          precision,
        };
      }
      default: {
        const precision =
          typeof (effect as { precision?: number }).precision === "number"
            ? Math.max(0, (effect as { precision?: number }).precision ?? 0)
            : 0;
        return {
          kind: "instant-gold",
          goldAwarded: 0,
          precision,
        };
      }
    }
  },
};

export function computeEffectiveMultiplier(s: BoostsState, now = Date.now()): number {
  const active = s.multipliers.filter((boost) => {
    if (boost.kind === "timed" && typeof boost.expiresAt === "number" && boost.expiresAt <= now) {
      return false;
    }
    if (
      boost.kind === "session" &&
      typeof boost.sessionsRemaining === "number" &&
      boost.sessionsRemaining <= 0
    ) {
      return false;
    }
    return true;
  });
  return active.reduce((product, boost) => product * (boost.factor > 0 ? boost.factor : 1), 1);
}

export function useBoosts() {
  const snapshot = useSyncExternalStore(
    boostsStore.subscribe,
    boostsStore.getSnapshot,
    boostsStore.getServerSnapshot,
  );
  const multiplier = computeEffectiveMultiplier(snapshot);
  const activeBoosts: ActiveBoost[] = snapshot.autoCollect
    ? [...snapshot.multipliers, snapshot.autoCollect]
    : [...snapshot.multipliers];

  return {
    state: snapshot,
    activeBoosts,
    multiplier,
    addSessionMultiplier: boostsStore.addSessionMultiplier,
    addTimedMultiplier: boostsStore.addTimedMultiplier,
    enableAutoCollect: boostsStore.enableAutoCollect,
    activateBoost: boostsStore.activateBoost,
    consumeSession: boostsStore.consumeSession,
    clearAll: boostsStore.clearAll,
  } as const;
}
