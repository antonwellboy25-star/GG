import { useEffect, useRef, useState } from "react";

type LoadingScreenProps = {
  durationMs?: number;
  onDone?: () => void;
};

const IMAGE_SRC = "./GG.png";

type PerfTier = "low" | "mid" | "high";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  size: number;
  colorKey: string;
  delay: number;
  scatter: number;
  pulse: number;
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function quantize(value: number, step: number) {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

function keyToColor(key: string): string {
  const parts = key.split("-");
  if (parts.length !== 3) return "rgb(255, 255, 255)";
  const [r, g, b] = parts.map((part) => Number.parseInt(part, 10) || 0);
  return `rgb(${r}, ${g}, ${b})`;
}

function makeGlowSprite(radius: number, color: string): HTMLCanvasElement {
  const scale = 2;
  const diameter = Math.max(8, Math.ceil(radius * 2 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = diameter;
  canvas.height = diameter;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const center = diameter / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.68, "rgba(255,255,255,0.25)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, diameter, diameter);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, diameter, diameter);
  context.globalCompositeOperation = "source-over";
  return canvas;
}

type ExtendedNavigator = Navigator & {
  hardwareConcurrency?: number;
  deviceMemory?: number;
};

function detectPerfTier(): PerfTier {
  try {
    const n = navigator as ExtendedNavigator;
    const cores = typeof n.hardwareConcurrency === "number" ? n.hardwareConcurrency : 4;
    const mem = typeof n.deviceMemory === "number" ? n.deviceMemory : undefined;
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

export default function LoadingScreen({ durationMs = 5000, onDone }: LoadingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const tier = detectPerfTier();
  const sceneReadyRef = useRef(false);
  const [imageReady, setImageReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [completionDelay, setCompletionDelay] = useState(durationMs);

  useEffect(() => {
    setCompletionDelay(durationMs);
  }, [durationMs]);

  useEffect(() => {
    const img = new Image();
    const handleReady = () => {
      imageRef.current = img;
      setImageReady(true);
    };
    const handleError = () => setImageReady(true);

    img.src = IMAGE_SRC;
    if (img.complete) {
      handleReady();
      return;
    }

    img.addEventListener("load", handleReady, { once: true });
    img.addEventListener("error", handleError, { once: true });

    return () => {
      img.removeEventListener("load", handleReady);
      img.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageReady) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    ctx.imageSmoothingEnabled = true;

    const gatherDuration = tier === "high" ? 2.15 : tier === "mid" ? 2.5 : 2.9;
    const revealLead = 0.4;
    const revealDuration = tier === "high" ? 0.85 : tier === "mid" ? 0.95 : 1.1;
    const revealStart = gatherDuration + revealLead;
    const minLogoHold = 1.25;
    const requiredDurationMs = Math.ceil((revealStart + revealDuration + minLogoHold) * 1000);
    setCompletionDelay((prev) => {
      const next = Math.max(durationMs, requiredDurationMs);
      return prev === next ? prev : next;
    });

    sceneReadyRef.current = false;
    setSceneReady(false);

    const spriteCache = new Map<string, HTMLCanvasElement>();
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let baseTime = 0;
    let lastTs = 0;

    const img = imageRef.current;
    if (!img) {
      const { innerWidth, innerHeight } = window;
      ctx.canvas.width = innerWidth;
      ctx.canvas.height = innerHeight;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      sceneReadyRef.current = true;
      setSceneReady(true);
      return;
    }

    const quantStep = tier === "high" ? 20 : tier === "mid" ? 28 : 42;
    const sampleStep = tier === "high" ? 3 : tier === "mid" ? 4 : 5;
    const delaySpread = tier === "high" ? 0.85 : tier === "mid" ? 1.1 : 1.5;
    const baseSize = tier === "high" ? 1.5 : tier === "mid" ? 1.24 : 1.08;
    const sizeBoost = tier === "high" ? 1.28 : tier === "mid" ? 1.08 : 0.9;

    const colorKey = (r: number, g: number, b: number) => {
      const rq = clamp(quantize(r, quantStep), 0, 255);
      const gq = clamp(quantize(g, quantStep), 0, 255);
      const bq = clamp(quantize(b, quantStep), 0, 255);
      return `${rq}-${gq}-${bq}`;
    };

    const spriteFor = (key: string, size: number) => {
      const cacheKey = `${key}_${size.toFixed(1)}`;
      let sprite = spriteCache.get(cacheKey);
      if (!sprite) {
        sprite = makeGlowSprite(size, keyToColor(key));
        spriteCache.set(cacheKey, sprite);
      }
      return sprite;
    };

    const rebuildParticles = () => {
      if (!width || !height) return;

      const maxWidth = width * 0.58;
      const maxHeight = height * 0.58;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const targetWidth = Math.max(32, Math.floor(img.width * scale));
      const targetHeight = Math.max(32, Math.floor(img.height * scale));

      const off = document.createElement("canvas");
      off.width = targetWidth;
      off.height = targetHeight;
      const offCtx = off.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.clearRect(0, 0, targetWidth, targetHeight);
      offCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const { data } = offCtx.getImageData(0, 0, targetWidth, targetHeight);

      const centerX = width / 2;
      const centerY = height / 2;
      const offsetX = centerX - targetWidth / 2;
      const offsetY = centerY - targetHeight / 2;

      const nextParticles: Particle[] = [];

      for (let y = 0; y < targetHeight; y += sampleStep) {
        for (let x = 0; x < targetWidth; x += sampleStep) {
          const idx = (y * targetWidth + x) * 4;
          const alpha = data[idx + 3];
          if (alpha < 40) continue;

          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const targetX = offsetX + x + (Math.random() - 0.5) * sampleStep * 0.55;
          const targetY = offsetY + y + (Math.random() - 0.5) * sampleStep * 0.55;
          const intensity = (r + g + b) / (3 * 255);
          const size = quantize(baseSize + intensity * sizeBoost, 0.2);
          const key = colorKey(r, g, b);

          const angle = Math.random() * Math.PI * 2;
          const radius = Math.max(width, height) * (0.24 + Math.random() * 0.4);
          const startX = centerX + Math.cos(angle) * radius;
          const startY = centerY + Math.sin(angle) * radius;

          nextParticles.push({
            x: startX,
            y: startY,
            vx: 0,
            vy: 0,
            tx: targetX,
            ty: targetY,
            size,
            colorKey: key,
            delay: Math.random() * delaySpread,
            scatter: 0.7 + Math.random() * 0.6,
            pulse: Math.random() * Math.PI * 2,
          });
        }
      }

      particles = nextParticles;
      spriteCache.clear();
      baseTime = 0;
      lastTs = 0;

      if (!sceneReadyRef.current && particles.length > 0) {
        sceneReadyRef.current = true;
        setSceneReady(true);
      }

      if (!particles.length) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        const fallbackScale = Math.min((width * 0.4) / img.width, (height * 0.4) / img.height, 1);
        const drawW = img.width * fallbackScale;
        const drawH = img.height * fallbackScale;
        ctx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
        if (!sceneReadyRef.current) {
          sceneReadyRef.current = true;
          setSceneReady(true);
        }
      }
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dprCap = tier === "high" ? 1.75 : tier === "mid" ? 1.45 : 1;
      dpr = Math.max(1, Math.min(dprCap, window.devicePixelRatio || 1));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (reduceMotion) {
        particles = [];
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        const staticScale = Math.min((width * 0.42) / img.width, (height * 0.42) / img.height, 1);
        const drawW = img.width * staticScale;
        const drawH = img.height * staticScale;
        ctx.drawImage(img, width / 2 - drawW / 2, height / 2 - drawH / 2, drawW, drawH);
        if (!sceneReadyRef.current) {
          sceneReadyRef.current = true;
          setSceneReady(true);
        }
        return;
      }

      rebuildParticles();
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) {
      return () => {
        window.removeEventListener("resize", resize);
      };
    }

    ctx.imageSmoothingEnabled = true;
    let running = true;

    const draw = (ts: number) => {
      if (!running) return;

      if (!baseTime) {
        baseTime = ts;
        lastTs = ts;
      }

      const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
      lastTs = ts;
      const elapsed = (ts - baseTime) / 1000;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, width, height);

      if (!particles.length) {
        const staticScale = Math.min((width * 0.4) / img.width, (height * 0.4) / img.height, 1);
        const drawW = img.width * staticScale;
        const drawH = img.height * staticScale;
        ctx.drawImage(img, width / 2 - drawW / 2, height / 2 - drawH / 2, drawW, drawH);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.globalCompositeOperation = "lighter";

      let settled = 0;

      const revealAlpha = clamp((elapsed - revealStart) / revealDuration, 0, 1);
      const trailAlpha = Math.max(0, 1 - revealAlpha * 0.9);

      for (const particle of particles) {
        const localTime = Math.max(0, elapsed - particle.delay);
        const gatherProgress = clamp(localTime / gatherDuration, 0, 1);
        const ease = easeOutCubic(gatherProgress);
        const swirlFactor = 1 - ease * ease;
        const swirlStrength =
          swirlFactor *
          (tier === "high" ? 68 : tier === "mid" ? 58 : 46) *
          (1 - revealAlpha * 0.85);
        const alignment = 6 + ease * 28;
        const damping = Math.exp(-dt * (5.4 - ease * 3.9));
        const swirlAngle = elapsed * (0.58 + particle.scatter * 0.16) + particle.pulse;

        const toTargetX = particle.tx - particle.x;
        const toTargetY = particle.ty - particle.y;
        particle.vx += toTargetX * alignment * dt;
        particle.vy += toTargetY * alignment * dt;
        particle.vx += Math.cos(swirlAngle) * swirlStrength * dt;
        particle.vy += Math.sin(swirlAngle) * swirlStrength * dt;

        particle.vx *= damping;
        particle.vy *= damping;

        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        if (gatherProgress > 0.9) {
          particle.x += toTargetX * 0.18;
          particle.y += toTargetY * 0.18;
          particle.vx *= 0.34;
          particle.vy *= 0.34;
        }

        if (gatherProgress > 0.975) {
          particle.x = particle.x * 0.48 + particle.tx * 0.52;
          particle.y = particle.y * 0.48 + particle.ty * 0.52;
        }

        const glowPulse = 0.82 + 0.06 * Math.sin(elapsed * 1.6 + particle.pulse);
        const alpha = clamp((0.26 + ease * 0.62) * (trailAlpha * 0.7 + 0.3), 0, 0.82);

        const sprite = spriteFor(particle.colorKey, particle.size);
        if (!sprite) continue;

        const sizePx = particle.size * 2;
        ctx.globalAlpha = alpha * glowPulse;
        ctx.drawImage(sprite, particle.x - sizePx / 2, particle.y - sizePx / 2, sizePx, sizePx);

        if (gatherProgress > 0.975) settled += 1;
      }

      ctx.globalAlpha = 1;

      if (particles.length && (settled / particles.length > 0.64 || revealAlpha > 0)) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = revealAlpha;
        const staticScale = Math.min((width * 0.48) / img.width, (height * 0.48) / img.height, 1);
        const drawW = img.width * staticScale;
        const drawH = img.height * staticScale;
        const glowAlpha = clamp(revealAlpha * 0.65, 0, 0.6);

        if (glowAlpha > 0.02) {
          ctx.save();
          ctx.translate(width / 2, height / 2);
          const glowScale = 1.03 + revealAlpha * 0.03;
          ctx.scale(glowScale, glowScale);
          ctx.globalAlpha = glowAlpha;
          ctx.filter = "blur(18px) saturate(135%)";
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }

        ctx.globalAlpha = revealAlpha;
        ctx.filter = "none";
        ctx.drawImage(img, width / 2 - drawW / 2, height / 2 - drawH / 2, drawW, drawH);
        ctx.globalAlpha = 1;
      }

      if (revealAlpha >= 1 && elapsed > revealStart + revealDuration + minLogoHold) {
        running = false;
        return;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener("resize", resize);
    };
  }, [imageReady, tier, durationMs]);

  useEffect(() => {
    if (!sceneReady) return;
    const timer = window.setTimeout(() => {
      onDone?.();
    }, completionDelay);
    return () => window.clearTimeout(timer);
  }, [sceneReady, completionDelay, onDone]);

  return (
    <div className="loader-root" aria-hidden>
      <canvas ref={canvasRef} className="particle-canvas" />
    </div>
  );
}
