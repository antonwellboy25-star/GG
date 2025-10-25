import { useEffect, useRef, useState } from "react";

type LoadingScreenProps = {
  durationMs?: number;
  onDone?: () => void;
};

const GOLD_COLORS = ["#c7971d", "#d9b140", "#f3d56d", "#f7e29a"];
const IMAGE_SRC = "/GG.png";

// Fast sine lookup to avoid Math.sin per particle per frame
const LUT_SIZE = 256;
const TAU = Math.PI * 2;
const SINE_LUT = (() => {
  const arr = new Float32Array(LUT_SIZE);
  for (let i = 0; i < LUT_SIZE; i++) arr[i] = Math.sin((i / LUT_SIZE) * TAU);
  return arr;
})();

const INV_TAU = 1 / TAU;
const LUT_SCALE = LUT_SIZE * INV_TAU; // multiply angle by this to get LUT index

function sinLut(angle: number): number {
  // Wrap angle to [0, TAU)
  while (angle < 0) angle += TAU;
  while (angle >= TAU) angle -= TAU;
  const idx = ((angle * LUT_SCALE) | 0) & (LUT_SIZE - 1);
  return SINE_LUT[idx];
}

function cosLut(angle: number): number {
  // cos(x) = sin(x + PI/2)
  return sinLut(angle + Math.PI / 2);
}

function makeGlowSprite(size: number, color: string): HTMLCanvasElement {
  const d = size * 2;
  const c = document.createElement("canvas");
  c.width = d;
  c.height = d;
  const g = c.getContext("2d");
  if (!g) return c;
  (g as CanvasRenderingContext2D).imageSmoothingEnabled = false;
  const grad = g.createRadialGradient(size, size, 0, size, size, size);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, d, d);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, d, d);
  g.globalCompositeOperation = "source-over";
  return c;
}

export default function LoadingScreen({ durationMs = 5000, onDone }: LoadingScreenProps) {
  // Determine perf tier once per render; cheap and fast
  const tier = detectPerfTier();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const motionStartRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    const markReady = () => setAssetsReady(true);
    img.src = IMAGE_SRC;
    if (img.complete) {
      markReady();
      return;
    }
    img.addEventListener("load", markReady, { once: true });
    img.addEventListener("error", markReady, { once: true });
    return () => {
      img.removeEventListener("load", markReady);
      img.removeEventListener("error", markReady);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let running = true;
    // Cap DPR depending on tier
    const dprCap = tier === "low" ? 1 : tier === "mid" ? 1.25 : 1.5;
    const dpr = Math.max(1, Math.min(dprCap, window.devicePixelRatio || 1));
    // Track current CSS pixel size to avoid overdraw with device pixels
    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      viewW = w;
      viewH = h;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // Reset transform to avoid cumulative scaling, then apply DPR
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Particle budget by tier and viewport size (CSS px)
    const area = viewW * viewH;
    const baseByTier = tier === "low" ? 60 : tier === "mid" ? 120 : 180;
    const scaleByArea = area < 600_000 ? 0.8 : area > 2_000_000 ? 1.2 : 1.0;
    const particleCount = Math.round(baseByTier * scaleByArea);
    // Prepare glow sprites cache per color and size
    // Keep dust tiny: small specks, not big blobs
    const spriteSizes = tier === "high" ? [4, 3, 2] : tier === "mid" ? [3, 2, 1] : [2, 1];
    const spriteCache = new Map<string, HTMLCanvasElement[]>();
    for (const col of GOLD_COLORS) {
      const arr: HTMLCanvasElement[] = [];
      for (const sz of spriteSizes) arr.push(makeGlowSprite(sz, col));
      spriteCache.set(col, arr);
    }

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      a: number; // base alpha amplitude
      hue: string;
      si: number; // sprite index by size
      tw: number; // twinkle phase
      twv: number; // twinkle velocity
      z: number; // depth factor 0..1 (0 = far, 1 = near)
    };
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const hue = GOLD_COLORS[(Math.random() * GOLD_COLORS.length) | 0];
      const z = Math.random();
      // choose sprite index by perceived depth (near -> larger)
      const si = Math.min(
        spriteSizes.length - 1,
        Math.max(0, (spriteSizes.length - 1 - z * (spriteSizes.length - 1)) | 0),
      );
      particles.push({
        x: Math.random() * viewW,
        y: Math.random() * viewH,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        a: 0.2 + z * 0.55,
        hue,
        si,
        tw: Math.random() * TAU,
        twv: 0.012 + Math.random() * 0.01,
        z,
      });
    }

    // Lightweight time-varying flow field to add chaotic yet smooth motion
    const fx1 = 2.2 * TAU; // frequencies in cycles across the viewport
    const fx2 = 3.8 * TAU;
    const fy1 = 2.6 * TAU;
    const fy2 = 4.4 * TAU;
    const sp1 = tier === "low" ? 0.12 : tier === "mid" ? 0.18 : 0.22; // angular speeds
    const sp2 = tier === "low" ? 0.09 : tier === "mid" ? 0.14 : 0.18;
    const sp3 = tier === "low" ? 0.1 : tier === "mid" ? 0.16 : 0.2;
    const sp4 = tier === "low" ? 0.07 : tier === "mid" ? 0.12 : 0.15;
    const phi1 = Math.random() * TAU;
    const phi2 = Math.random() * TAU;
    const phi3 = Math.random() * TAU;
    const phi4 = Math.random() * TAU;

    const frameInterval = tier === "low" ? 1000 / 24 : 1000 / 30; // ~24-30 FPS cap
    const draw = (ts: number) => {
      if (!running) return;
      if (motionStartRef.current == null) motionStartRef.current = ts;
      const elapsed = ts - motionStartRef.current;

      if (ts - lastFrameRef.current < frameInterval) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameRef.current = ts;

      if (document.hidden) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, viewW, viewH);

      ctx.save();
      if (tier === "high") ctx.globalCompositeOperation = "lighter";
      (ctx as CanvasRenderingContext2D).imageSmoothingEnabled = false;

      const t = elapsed / 1000;
      const theta = t * 0.3;
      const driftX = cosLut(theta) * 0.06;
      const driftY = sinLut(theta) * 0.06;

      for (const p of particles) {
        const nx = p.x / viewW;
        const ny = p.y / viewH;
        const fx = sinLut(nx * fx1 + t * sp1 + phi1) + sinLut(nx * fx2 - t * sp2 + phi2);
        const fy = sinLut(ny * fy1 - t * sp3 + phi3) + sinLut(ny * fy2 + t * sp4 + phi4);
        const flowAmp = tier === "low" ? 0.06 : tier === "mid" ? 0.08 : 0.1;
        const zScale = 0.45 + p.z * 0.75;
        const targetVx = fx * flowAmp * zScale + driftX * (0.55 + p.z * 0.45);
        const targetVy = fy * flowAmp * zScale + driftY * (0.55 + p.z * 0.45);
        const acc = tier === "low" ? 0.034 : tier === "mid" ? 0.044 : 0.052;
        p.vx += (targetVx - p.vx) * acc;
        p.vy += (targetVy - p.vy) * acc;

        p.x += p.vx * (0.88 + p.z * 0.4);
        p.y += p.vy * (0.88 + p.z * 0.4);
        p.tw += p.twv;
        if (p.tw > TAU) p.tw -= TAU;
        const idx = ((p.tw * LUT_SIZE) / TAU) | 0;
        const twinkle = 0.48 + SINE_LUT[idx] * 0.32;

        if (p.x < -5) p.x = viewW + 5;
        if (p.x > viewW + 5) p.x = -5;
        if (p.y < -5) p.y = viewH + 5;
        if (p.y > viewH + 5) p.y = -5;

        ctx.globalAlpha = Math.max(0, Math.min(1, p.a * twinkle));
        const sprites = spriteCache.get(p.hue)!;
        const sprite = sprites[p.si];
        const size = (sprite.width / 2) | 0;
        const x = (p.x - size) | 0;
        const y = (p.y - size) | 0;
        ctx.drawImage(sprite, x, y);
      }

      ctx.globalAlpha = 1;
      ctx.restore();

      if (assetsReady) {
        if (startTimeRef.current == null) startTimeRef.current = ts;
        const cappedElapsed = ts - startTimeRef.current;
        if (cappedElapsed < durationMs + 120) {
          rafRef.current = requestAnimationFrame(draw);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [assetsReady, durationMs]);

  useEffect(() => {
    if (!assetsReady) return;
    const doneTimer = window.setTimeout(() => {
      onDone?.();
    }, durationMs);
    return () => window.clearTimeout(doneTimer);
  }, [assetsReady, durationMs, onDone]);

  return (
    <div className="loader-root" aria-hidden>
      <canvas ref={canvasRef} className="dust-canvas" />
      <div className="center-wrap">
        {/* Image with neon glow */}
        <img src={IMAGE_SRC} alt="GG" className="gg-logo" />
        {/* Circular neon progress */}
        <svg className="progress-ring" viewBox="0 0 120 120" role="img">
          <title>Loading</title>
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.75)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
            </linearGradient>
            <filter id="whiteGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.9" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            className="ring-bg"
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2.4"
          />
          <circle
            className="ring-fg"
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth="2.4"
            filter="url(#whiteGlow)"
            pathLength={100}
          />
        </svg>
      </div>
    </div>
  );
}

function detectPerfTier(): "low" | "mid" | "high" {
  try {
    const cores = (navigator as any).hardwareConcurrency ?? 4;
    const mem = (navigator as any).deviceMemory as number | undefined;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;
    const reduced = matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) return "low";
    if ((mem && mem <= 4) || cores <= 4 || area >= 4_000_000) return "low";
    if ((mem && mem <= 8) || cores <= 8 || area >= 2_500_000) return "mid";
    return "high";
  } catch {
    return "mid";
  }
}
