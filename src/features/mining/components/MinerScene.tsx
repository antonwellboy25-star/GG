import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import ggTextureUrl from "@/assets/images/GG.png";
import gramTextureUrl from "@/assets/images/GRAM.png";

type MinerSceneProps = {
  active: boolean;
  cycleMs?: number;
};

const PARTICLE_COUNT = 3200;
const STREAM_COUNT = 1200;
const DEFAULT_CYCLE = 4200;
const MIN_CYCLE = 3200;
const TWO_PI = Math.PI * 2;
const BASE_PARTICLE_COLOR = new THREE.Color(0xf4c87d);
const ABSORB_PARTICLE_COLOR = new THREE.Color(0xffb56f);
const FLASH_PARTICLE_COLOR = new THREE.Color(0xfff6d9);
const EMIT_PARTICLE_COLOR = new THREE.Color(0xf6dba4);
const TEMP_PARTICLE_COLOR = new THREE.Color();

const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const term = t - 1;
  return 1 + c3 * term * term * term + c1 * term * term;
};
const easeInSine = (t: number) => 1 - Math.cos((t * Math.PI) / 2);

const getNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const initialNow = getNow();

const isWebGLAvailable = () => {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return (
      !!window.WebGLRenderingContext &&
      !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
};

type ParticleField = {
  points: THREE.Points;
  attribute: THREE.BufferAttribute;
  spherical: Float32Array;
  seeds: Float32Array;
  material: THREE.PointsMaterial;
  radius: number;
};

type StreamField = {
  points: THREE.Points;
  attribute: THREE.BufferAttribute;
  offsets: Float32Array;
  seeds: Float32Array;
  material: THREE.PointsMaterial;
  sizes: THREE.BufferAttribute;
  shader: THREE.ShaderMaterial;
};

type CoinMeshes = {
  gram: THREE.Mesh;
  gg: THREE.Mesh;
};

type Halo = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
};

type ViewportMetrics = {
  width: number;
  height: number;
  entryX: number;
  exitX: number;
};

type TimelineState = {
  progress: number;
  approach: number;
  dissolve: number;
  absorb: number;
  flash: number;
  emit: number;
  release: number;
  gramPos: THREE.Vector3;
  ggPos: THREE.Vector3;
};

export default function MinerScene({ active, cycleMs = DEFAULT_CYCLE }: MinerSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const particleFieldRef = useRef<ParticleField | null>(null);
  const streamFieldRef = useRef<StreamField | null>(null);
  const coinMeshesRef = useRef<CoinMeshes | null>(null);
  const haloRef = useRef<Halo | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const particleTextureRef = useRef<THREE.Texture | null>(null);
  const timelineRef = useRef<TimelineState>({
    progress: 0,
    approach: 0,
    dissolve: 0,
    absorb: 0,
    flash: 0,
    emit: 0,
    release: 0,
    gramPos: new THREE.Vector3(),
    ggPos: new THREE.Vector3(),
  });

  const lastTimeRef = useRef(initialNow);
  const cohesionRef = useRef(active ? 1 : 0);
  const targetCohesionRef = useRef(active ? 1 : 0);

  const activeRef = useRef(active);
  const coinEnabledRef = useRef(false);
  const coinStartRef = useRef(initialNow);
  const viewportRef = useRef<ViewportMetrics | null>(null);
  const baseCoinScaleRef = useRef(1);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    activeRef.current = active;
    targetCohesionRef.current = active ? 1 : 0;
    if (!active) {
      coinEnabledRef.current = false;
      const meshes = coinMeshesRef.current;
      if (meshes) {
        const gramMat = meshes.gram.material as THREE.MeshBasicMaterial;
        const ggMat = meshes.gg.material as THREE.MeshBasicMaterial;
        gramMat.opacity = 0;
        ggMat.opacity = 0;
        meshes.gram.visible = false;
        meshes.gg.visible = false;
      }
      const halo = haloRef.current;
      if (halo) {
        halo.material.opacity = 0;
        halo.sprite.visible = false;
      }
      const stream = streamFieldRef.current;
      if (stream) {
        stream.material.opacity = 0;
        stream.shader.uniforms.uOpacity.value = 0;
        stream.points.visible = false;
        (stream.sizes.array as Float32Array).fill(0);
        stream.sizes.needsUpdate = true;
      }
      const timeline = timelineRef.current;
      timeline.progress = 0;
      timeline.approach = 0;
      timeline.dissolve = 0;
      timeline.absorb = 0;
      timeline.flash = 0;
      timeline.emit = 0;
      timeline.release = 0;
      timeline.gramPos.set(0, 0, 0);
      timeline.ggPos.set(0, 0, 0);
    }
  }, [active]);

  const updateCohesion = useCallback((dt: number) => {
    const current = cohesionRef.current;
    const target = targetCohesionRef.current;
    const speed = target > current ? 7.4 : 4.2;
    cohesionRef.current = THREE.MathUtils.damp(current, target, speed, dt);
  }, []);

  const updateParticles = useCallback((now: number, dt: number) => {
    const field = particleFieldRef.current;
    if (!field) return;

    const { attribute, spherical, seeds, points, material, radius } = field;
    const arr = attribute.array as Float32Array;
    const cohesion = clamp01(cohesionRef.current);
    const timeline = timelineRef.current;
    const approach = clamp01(timeline.approach);
    const dissolve = clamp01(timeline.dissolve);
    const absorb = clamp01(timeline.absorb);
    const flash = clamp01(timeline.flash);
    const emit = clamp01(timeline.emit);
    const release = clamp01(timeline.release);
    const emission = Math.max(emit, release);

    const intake = clamp01(approach * 0.6 + dissolve * 0.85 + absorb * 1.05);
    const blendBase = cohesion;
    const blend = clamp01(
      blendBase + dissolve * 0.4 + absorb * 0.35 + flash * 0.25 + approach * 0.12 - emission * 0.45,
    );
    const swirlBase = 1 - cohesion;
    const swirl = clamp01(swirlBase + emission * 0.35 + flash * 0.18 - (dissolve + absorb) * 0.28);
    const jitterAmplifier = 1 + flash * 0.5 + emission * 0.28;
    const radiusFactor = THREE.MathUtils.clamp(
      1 + flash * 0.24 + absorb * 0.12 + emission * 0.08 - dissolve * 0.14 - approach * 0.06,
      0.72,
      1.34,
    );
    const dynamicRadius = radius * radiusFactor;

    const time = now * 0.00062;
    const band = now * 0.0011;
    const waveAmplitude = 0.06 + flash * 0.18 + absorb * 0.08 - emission * 0.05;
    const swirlScale = 0.42 + emission * 0.28 + approach * 0.1;
    const tiltScale = 0.55 + emission * 0.2;
    const gramPos = timeline.gramPos;
    const ggPos = timeline.ggPos;
    const gramLenSq = gramPos.lengthSq();
    const ggLenSq = ggPos.lengthSq();

    let gramDirX = 0;
    let gramDirY = 0;
    let gramDirZ = 0;
    if (gramLenSq > 1e-6) {
      const invLen = 1 / Math.sqrt(gramLenSq);
      gramDirX = -gramPos.x * invLen;
      gramDirY = -gramPos.y * invLen;
      gramDirZ = -gramPos.z * invLen;
    }

    let ggDirX = 0;
    let ggDirY = 0;
    let ggDirZ = 0;
    if (ggLenSq > 1e-6) {
      const invLen = 1 / Math.sqrt(ggLenSq);
      ggDirX = ggPos.x * invLen;
      ggDirY = ggPos.y * invLen;
      ggDirZ = ggPos.z * invLen;
    }

    const gramBurst = clamp01(dissolve * 1.4 + absorb * 0.35);
    const gramShear = clamp01(approach * 0.4 + dissolve * 0.6);
    const gramOffsetBase = gramBurst * (0.22 + gramShear * 0.36);
    const gramSpreadBase = gramBurst * (0.12 + gramShear * 0.22);

    const emitBurst = clamp01(emission * 1.2 + flash * 0.4);
    const emitOffsetBase = emitBurst * (0.26 + absorb * 0.18);
    const emitHollowBase = emitBurst * 0.18;

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const idx = i * 3;
      const theta = spherical[idx];
      const phi = spherical[idx + 1];
      const radial = spherical[idx + 2];
      const seed = seeds[i];

      const swirlRadius = radial + Math.sin(time * 1.35 + seed * 14.2) * swirlScale;
      const swirlAngle = phi + time * (1.6 + seed * 0.9);
      const swirlTilt = Math.cos(time * 0.9 + seed * 12.4) * tiltScale;

      const swirlX = swirlRadius * Math.cos(swirlAngle);
      const swirlY = swirlTilt + Math.sin(phi * 2.1 + time * 0.72) * 0.32;
      const swirlZ = swirlRadius * Math.sin(swirlAngle);

      const sinTheta = Math.sin(theta);
      const sphereX = sinTheta * Math.cos(phi);
      const sphereY = Math.cos(theta);
      const sphereZ = sinTheta * Math.sin(phi);
      const sphereRad =
        dynamicRadius * (0.86 + seed * 0.18 + Math.sin(band + seed * 6.3) * waveAmplitude);

      const targetX = sphereX * sphereRad;
      const targetY = sphereY * sphereRad;
      const targetZ = sphereZ * sphereRad;

      const jitter = (1 - blend * 0.55) * 0.28 * jitterAmplifier;
      const leftPull = -intake * (0.42 + seed * 0.18);
      const liftPull = intake * 0.12 * Math.sin(phi + seed * 5.1 + time * 0.7);
      const depthPull = -intake * 0.08 * Math.cos(phi * 1.2 + seed * 3.4 + time * 0.6);
      const flowFactor = THREE.MathUtils.lerp(1, 0, blend * 0.85);
      let flowX = leftPull * flowFactor;
      let flowY = liftPull * flowFactor;
      let flowZ = depthPull * flowFactor;

      if (gramOffsetBase > 0 && gramLenSq > 1e-6) {
        const burstStrength = gramOffsetBase * (0.4 + seed * 0.3);
        const spreadStrength = gramSpreadBase * (0.32 + seed * 0.25);
        flowX +=
          gramDirX * burstStrength + (gramDirY * spreadStrength - gramDirZ * spreadStrength * 0.4);
        flowY += gramDirY * burstStrength + gramDirZ * spreadStrength * 0.16;
        flowZ +=
          gramDirZ * burstStrength +
          (gramDirX * spreadStrength * 0.22 - gramDirY * spreadStrength * 0.14);
      }

      if (emitOffsetBase > 0 && ggLenSq > 1e-6) {
        const emitStrength = emitOffsetBase * (0.38 + (1 - seed) * 0.28);
        const hollowStrength = emitHollowBase * (0.22 + seed * 0.18);
        flowX += ggDirX * emitStrength - ggDirX * hollowStrength * blend * 0.6;
        flowY += ggDirY * emitStrength - ggDirY * hollowStrength * blend * 0.5;
        flowZ += ggDirZ * emitStrength - ggDirZ * hollowStrength * blend * 0.7;
      }

      arr[idx] =
        THREE.MathUtils.lerp(swirlX, targetX, blend) +
        flowX +
        Math.sin(time * 3.6 + seed * 20.5) * jitter;
      arr[idx + 1] =
        THREE.MathUtils.lerp(swirlY, targetY, blend) +
        flowY +
        Math.cos(time * 2.8 + seed * 18.2) * jitter * 0.62;
      arr[idx + 2] =
        THREE.MathUtils.lerp(swirlZ, targetZ, blend) +
        flowZ +
        Math.sin(time * 3.1 + seed * 16.7) * jitter;
    }

    attribute.needsUpdate = true;
    points.rotation.y += dt * (0.18 + swirl * 0.32 + emission * 0.18);
    const tiltTarget = dissolve * 0.14 + absorb * 0.26 + flash * 0.18 - emission * 0.22;
    points.rotation.x = THREE.MathUtils.damp(points.rotation.x, tiltTarget, 4.2, dt);
    const scaleTarget = 1 + flash * 0.4 + absorb * 0.18 + emission * 0.1 - dissolve * 0.12;
    const nextScale = THREE.MathUtils.damp(points.scale.x, scaleTarget, 6.2, dt);
    points.scale.setScalar(nextScale);

    const baseOpacity = THREE.MathUtils.lerp(0.44, 0.82, blend);
    const targetOpacity = Math.min(baseOpacity + flash * 0.3 + absorb * 0.12 + emission * 0.18, 1);
    material.opacity = THREE.MathUtils.damp(material.opacity, targetOpacity, 5.4, dt);

    TEMP_PARTICLE_COLOR.copy(BASE_PARTICLE_COLOR);
    if (dissolve > 0 || absorb > 0) {
      const absorbMix = clamp01(dissolve * 0.45 + absorb * 0.8);
      TEMP_PARTICLE_COLOR.lerp(ABSORB_PARTICLE_COLOR, absorbMix);
    }
    if (emission > 0) {
      TEMP_PARTICLE_COLOR.lerp(EMIT_PARTICLE_COLOR, clamp01(emission * 0.6));
    }
    if (flash > 0) {
      TEMP_PARTICLE_COLOR.lerp(FLASH_PARTICLE_COLOR, clamp01(flash));
    }
    const colorLerp = THREE.MathUtils.clamp(0.18 + flash * 0.2 + emission * 0.1, 0.18, 0.65);
    material.color.lerp(TEMP_PARTICLE_COLOR, colorLerp);
  }, []);

  const animateStream = useCallback((mode: "entry" | "release" | null, progress: number) => {
    const field = streamFieldRef.current;
    const viewport = viewportRef.current;
    if (!field || !viewport) return;

    const { attribute, offsets, seeds, material, points, sizes, shader } = field;
    const positions = attribute.array as Float32Array;
    const sizeArr = sizes.array as Float32Array;

    const time = getNow() * 0.0013;

    if (!mode) {
      const current = shader.uniforms.uOpacity.value as number;
      const next = THREE.MathUtils.damp(current, 0, 7.8, 0.016);
      shader.uniforms.uOpacity.value = next;
      material.opacity = next;
      sizeArr.fill(0);
      sizes.needsUpdate = true;
      if (next < 0.03) {
        points.visible = false;
      }
      return;
    }

    const head = clamp01(progress);
    const headBalanced = clamp01(4 * head * (1 - head));
    const minTail = mode === "entry" ? 0.05 : 0.07;
    const maxTail = mode === "entry" ? 0.18 : 0.24;
    const tailSpan = THREE.MathUtils.lerp(minTail, maxTail, headBalanced);
    const jitterBase = mode === "entry" ? 0.016 : 0.02;

    shader.uniforms.uColor.value.setHex(mode === "entry" ? 0xf0b45a : 0xfdf4d2);
    const targetOpacity = mode === "entry" ? 0.6 + head * 0.34 : 0.66 + head * 0.38;
    const currentOpacity = shader.uniforms.uOpacity.value as number;
    const nextOpacity = THREE.MathUtils.damp(
      currentOpacity,
      Math.min(targetOpacity, 1),
      6.6,
      0.016,
    );
    shader.uniforms.uOpacity.value = nextOpacity;
    material.opacity = nextOpacity;

    if (nextOpacity < 0.02 && head < 0.01) {
      points.visible = false;
      return;
    }

    points.visible = true;

    let anyVisible = false;
    const widthScale = viewport.width * jitterBase;
    const heightScale = viewport.height * jitterBase * 0.82;
    const baseHead =
      mode === "entry"
        ? getEntryBasePosition(head, viewport)
        : getReleaseBasePosition(head, viewport);
    const headPoint = baseHead;
    const tangent = getStreamTangent(mode, head, viewport);
    const tangentMag = Math.hypot(tangent.x, tangent.y, tangent.z) || 1;
    const dirX = tangent.x / tangentMag;
    const dirY = tangent.y / tangentMag;
    const dirZ = tangent.z / tangentMag;
    const lateralX = -dirY;
    const lateralY = dirX;
    const headGap = Math.max(0.01, tailSpan * 0.12);
    const minSample = mode === "release" ? 0.055 : 0;

    for (let i = 0; i < STREAM_COUNT; i += 1) {
      const idx = i * 3;
      const offset = offsets[i];
      const nX = seeds[idx];
      const nY = seeds[idx + 1];
      const nZ = seeds[idx + 2];

      if (head <= 0.0001) {
        sizeArr[i] = 0;
        continue;
      }

      const sampleProgress = clamp01(Math.max(minSample, head - headGap - offset * tailSpan));
      if (sampleProgress >= head) {
        sizeArr[i] = 0;
        continue;
      }

      const pathPoint =
        mode === "entry"
          ? sampleEntryPath(sampleProgress, viewport, nX, nY)
          : sampleReleasePath(sampleProgress, viewport, nX, nY);

      const alongTail = clamp01((head - sampleProgress) / Math.max(tailSpan, 0.001));
      const jitterStrength = (1 - alongTail * 0.85) * (mode === "entry" ? 0.2 : 0.24);
      const sinJ = Math.sin(time * 3.6 + nX * 9.7) * jitterStrength * widthScale;
      const cosJ = Math.cos(time * 3.2 + nY * 8.9) * jitterStrength * heightScale;
      const depthJ = Math.sin(time * 4.1 + nZ * 11.3) * jitterStrength * 0.08;

      let posX = pathPoint.x + sinJ + lateralX * jitterStrength * 0.12;
      let posY = pathPoint.y + cosJ + lateralY * jitterStrength * 0.12;
      let posZ = pathPoint.z + depthJ;

      const relX = posX - headPoint.x;
      const relY = posY - headPoint.y;
      const relZ = posZ - headPoint.z;
      const forward = relX * dirX + relY * dirY + relZ * dirZ;
      const desiredBack = headGap + alongTail * tailSpan * 0.72;
      if (forward > -desiredBack) {
        const adjust = forward + desiredBack;
        posX -= dirX * adjust;
        posY -= dirY * adjust;
        posZ -= dirZ * adjust;
      }

      positions[idx] = posX;
      positions[idx + 1] = posY;
      positions[idx + 2] = posZ;

      const fadeStart = 0.45;
      const fadeProgress = alongTail <= fadeStart ? 0 : (alongTail - fadeStart) / (1 - fadeStart);
      const sizeFactor = THREE.MathUtils.clamp(1 - fadeProgress * 0.9, 0.02, 1);
      sizeArr[i] = sizeFactor;

      if (sizeFactor > 0.02) {
        anyVisible = true;
      }
    }

    attribute.needsUpdate = true;
    sizes.needsUpdate = true;

    if (!anyVisible) {
      const faded = THREE.MathUtils.damp(shader.uniforms.uOpacity.value as number, 0, 7.2, 0.016);
      shader.uniforms.uOpacity.value = faded;
      material.opacity = faded;
      if (faded < 0.02) {
        points.visible = false;
      }
    }
  }, []);

  const updateCoins = useCallback(
    (now: number, cycle: number, dt: number) => {
      const meshes = coinMeshesRef.current;
      const viewport = viewportRef.current;
      if (!meshes || !viewport) return;

      const { gram, gg } = meshes;
      const gramMat = gram.material as THREE.MeshBasicMaterial;
      const ggMat = gg.material as THREE.MeshBasicMaterial;
      const camera = cameraRef.current;
      const halo = haloRef.current;
      const timeline = timelineRef.current;

      if (camera) {
        gram.quaternion.copy(camera.quaternion);
        gg.quaternion.copy(camera.quaternion);
        if (halo) {
          halo.sprite.quaternion.copy(camera.quaternion);
        }
      }

      const cohesion = clamp01(cohesionRef.current);
      const ready = cohesion > 0.68 && activeRef.current;
      if (ready && !coinEnabledRef.current) {
        coinEnabledRef.current = true;
        coinStartRef.current = now;
      }

      if (!coinEnabledRef.current) {
        gram.visible = false;
        gg.visible = false;
        gramMat.opacity = THREE.MathUtils.damp(gramMat.opacity, 0, 8, dt);
        ggMat.opacity = THREE.MathUtils.damp(ggMat.opacity, 0, 8, dt);
        timeline.approach = clamp01(THREE.MathUtils.damp(timeline.approach, 0, 6.5, dt));
        timeline.dissolve = clamp01(THREE.MathUtils.damp(timeline.dissolve, 0, 6.8, dt));
        timeline.absorb = clamp01(THREE.MathUtils.damp(timeline.absorb, 0, 7.2, dt));
        timeline.flash = clamp01(THREE.MathUtils.damp(timeline.flash, 0, 8.6, dt));
        timeline.emit = clamp01(THREE.MathUtils.damp(timeline.emit, 0, 7.2, dt));
        timeline.release = clamp01(THREE.MathUtils.damp(timeline.release, 0, 7.2, dt));
        timeline.progress = 0;
        timeline.gramPos.set(0, 0, 0);
        timeline.ggPos.set(0, 0, 0);
        animateStream(null, 0);
        if (halo) {
          halo.material.opacity = THREE.MathUtils.damp(halo.material.opacity, 0, 6.4, dt);
          const newScale = THREE.MathUtils.damp(halo.sprite.scale.x, 1.08, 6.4, dt);
          halo.sprite.scale.set(newScale, newScale, 1);
          if (halo.material.opacity < 0.02) {
            halo.sprite.visible = false;
          }
        }
        return;
      }

      const duration = Math.max(cycle, MIN_CYCLE);
      const progress = ((now - coinStartRef.current) % duration) / duration;
      const baseScale = baseCoinScaleRef.current;
      timeline.progress = progress;

      const approachPhase = phaseWindow(progress, 0, 0.28);
      const dissolvePhase = phaseWindow(progress, 0.28, 0.18);
      const absorbPhase = phaseWindow(progress, 0.46, 0.12);
      const flashPhase = phaseWindow(progress, 0.54, 0.1);
      const emitPhase = phaseWindow(progress, 0.62, 0.18);
      const launchPhase = phaseWindow(progress, 0.8, 0.16);
      const cooldownPhase = phaseWindow(progress, 0.96, 0.04);

      const targetApproach = approachPhase !== null ? easeInOutCubic(approachPhase) : 0;
      const targetDissolve = dissolvePhase !== null ? easeInOutCubic(dissolvePhase) : 0;
      const targetAbsorb = absorbPhase !== null ? easeInOutCubic(absorbPhase) : 0;
      const targetFlash = flashPhase !== null ? easeOutExpo(flashPhase) : 0;
      const targetEmit = emitPhase !== null ? easeInOutCubic(emitPhase) : 0;
      const targetRelease = launchPhase !== null ? easeInOutCubic(launchPhase) : 0;

      timeline.approach = clamp01(THREE.MathUtils.damp(timeline.approach, targetApproach, 6.8, dt));
      timeline.dissolve = clamp01(THREE.MathUtils.damp(timeline.dissolve, targetDissolve, 7.2, dt));
      timeline.absorb = clamp01(THREE.MathUtils.damp(timeline.absorb, targetAbsorb, 8.2, dt));
      timeline.flash = clamp01(THREE.MathUtils.damp(timeline.flash, targetFlash, 9.4, dt));
      timeline.emit = clamp01(THREE.MathUtils.damp(timeline.emit, targetEmit, 7.4, dt));
      timeline.release = clamp01(THREE.MathUtils.damp(timeline.release, targetRelease, 7.4, dt));

      const timeWave = now * 0.0012;

      let haloTargetOpacity = 0.18;
      let haloTargetScale = Math.max(1.08, halo?.sprite.scale.x ?? 1.2);

      if (approachPhase !== null) {
        const arc = easeInOutCubic(approachPhase);
        const wave = Math.sin(arc * Math.PI * 0.8);
        const wobble = Math.sin(timeWave + arc * 4.2) * (1 - arc * 0.8) * 0.14;
        gram.visible = true;
        gg.visible = false;
        const x = THREE.MathUtils.lerp(viewport.entryX * 0.9, -viewport.width * 0.04, arc);
        const y =
          THREE.MathUtils.lerp(viewport.height * 0.12, viewport.height * 0.022, arc) +
          wave * viewport.height * 0.018;
        const z = THREE.MathUtils.lerp(-0.22, -0.1, arc);
        gram.position.set(x, y, z);
        const scale = THREE.MathUtils.lerp(1.12, 0.98, arc);
        gram.scale.set(scale * baseScale, scale * baseScale, 1);
        gram.rotation.z = wobble;
        gram.rotation.y = Math.sin(arc * Math.PI * 0.5) * 0.12;
        const approachFade = THREE.MathUtils.clamp(1 - arc ** 2.4 * 0.18, 0.72, 1);
        const approachTarget = Math.max(approachFade, gramMat.opacity);
        gramMat.opacity = THREE.MathUtils.damp(gramMat.opacity, approachTarget, 12, dt);
        timeline.gramPos.copy(gram.position);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.22 + arc * 0.2);
        haloTargetScale = Math.max(haloTargetScale, 1.12 + arc * 0.22);
      }

      if (dissolvePhase !== null) {
        const eased = easeInOutCubic(dissolvePhase);
        gram.visible = true;
        const hover =
          THREE.MathUtils.lerp(viewport.height * 0.022, viewport.height * 0.008, eased) +
          Math.sin(timeWave * 1.4 + eased * 5.1) * 0.012;
        const depth = THREE.MathUtils.lerp(-0.1, -0.028, eased);
        const lateral = THREE.MathUtils.lerp(
          -viewport.width * 0.04,
          -viewport.width * 0.006,
          eased,
        );
        gram.position.set(lateral, hover, depth);
        const scale = THREE.MathUtils.lerp(0.98, 0.3, eased);
        gram.scale.set(scale * baseScale, scale * baseScale, 1);
        gram.rotation.z = Math.sin(timeWave * 0.8 + eased * 6.3) * 0.24;
        gram.rotation.y = Math.sin(timeWave * 0.6 + eased * 3.8) * 0.18;
        const fadeCurve = easeInOutCubic(eased);
        const dissolveTarget = THREE.MathUtils.clamp(1 - fadeCurve ** 1.15, 0, 1);
        gramMat.opacity = THREE.MathUtils.damp(gramMat.opacity, dissolveTarget, 18, dt);
        if (gramMat.opacity < 0.032) {
          gram.visible = false;
        }
        timeline.gramPos.copy(gram.position);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.32 + eased * 0.36);
        haloTargetScale = Math.max(haloTargetScale, 1.24 + eased * 0.6);
      } else if (approachPhase === null) {
        gramMat.opacity = THREE.MathUtils.damp(gramMat.opacity, 0, 8, dt);
        if (gramMat.opacity < 0.05) {
          gram.visible = false;
        }
        timeline.gramPos.set(0, 0, 0);
      }

      if (absorbPhase !== null) {
        const eased = easeInOutCubic(absorbPhase);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.46 + eased * 0.38);
        haloTargetScale = Math.max(haloTargetScale, 1.36 + eased * 0.9);
      }

      if (flashPhase !== null) {
        const flare = easeOutExpo(flashPhase);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.78 + flare * 0.4);
        haloTargetScale = Math.max(haloTargetScale, 1.6 + flare * 0.8);
      }

      if (emitPhase !== null) {
        const arc = easeInOutCubic(emitPhase);
        const reveal = easeInOutCubic(emitPhase);
        const glow = easeOutExpo(emitPhase);
        gg.visible = true;
        const x = THREE.MathUtils.lerp(-viewport.width * 0.004, viewport.width * 0.14, arc);
        const y = THREE.MathUtils.lerp(viewport.height * 0.008, viewport.height * 0.06, arc);
        const z = THREE.MathUtils.lerp(-0.028, 0.08, arc);
        gg.position.set(x, y, z);
        const scale = THREE.MathUtils.lerp(0.28, 0.86, reveal);
        gg.scale.set(scale * baseScale, scale * baseScale, 1);
        gg.rotation.z = Math.sin(arc * Math.PI * 0.9) * 0.12;
        gg.rotation.y = Math.sin(arc * Math.PI * 0.6) * 0.1;
        const emitTarget = THREE.MathUtils.clamp(reveal ** 1.4, 0, 1);
        const haloAssist = THREE.MathUtils.clamp(glow * 0.6, 0, 0.72);
        ggMat.opacity = THREE.MathUtils.damp(ggMat.opacity, emitTarget + haloAssist * 0.2, 11, dt);
        timeline.ggPos.copy(gg.position);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.58 + reveal * 0.32);
        haloTargetScale = Math.max(haloTargetScale, 1.48 + reveal * 0.6);
      }

      if (launchPhase !== null) {
        const arc = easeInOutCubic(launchPhase);
        gg.visible = true;
        const x = THREE.MathUtils.lerp(viewport.width * 0.14, viewport.exitX, arc);
        const y =
          THREE.MathUtils.lerp(viewport.height * 0.06, viewport.height * 0.04, arc) - arc * 0.04;
        const z = THREE.MathUtils.lerp(0.08, 0.24, arc);
        gg.position.set(x, y, z);
        const releaseScale = baseScale * (0.86 + arc * 0.34);
        gg.scale.set(releaseScale, releaseScale, 1);
        gg.rotation.z = -Math.sin(arc * Math.PI * 0.8) * 0.1;
        gg.rotation.y = Math.sin(arc * Math.PI * 0.3) * 0.08;
        ggMat.opacity = THREE.MathUtils.damp(ggMat.opacity, 1, 12, dt);
        timeline.ggPos.copy(gg.position);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.44 + arc * 0.2);
        haloTargetScale = Math.max(haloTargetScale, 1.3 + arc * 0.3);
      } else if (emitPhase === null) {
        ggMat.opacity = THREE.MathUtils.damp(ggMat.opacity, 0, 8, dt);
        if (ggMat.opacity < 0.05) {
          gg.visible = false;
        }
        if (launchPhase === null) {
          timeline.ggPos.set(0, 0, 0);
        }
      }

      if (cooldownPhase !== null) {
        const fade = 1 - easeInSine(cooldownPhase);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.18 * fade);
      }

      animateStream(null, 0);

      if (halo) {
        halo.sprite.visible = true;
        halo.material.opacity = THREE.MathUtils.damp(
          halo.material.opacity,
          haloTargetOpacity,
          6.2,
          dt,
        );
        const newScale = THREE.MathUtils.damp(halo.sprite.scale.x, haloTargetScale, 6, dt);
        halo.sprite.scale.set(newScale, newScale, 1);
        if (halo.material.opacity < 0.02) {
          halo.sprite.visible = false;
        }
      }
    },
    [animateStream],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || fallback) return;

    if (!isWebGLAvailable()) {
      setFallback(true);
      return;
    }

    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let observer: ResizeObserver | null = null;
    let resizeListenerAttached = false;

    try {
      scene = new THREE.Scene();
      sceneRef.current = scene;

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
      camera.position.set(0, 0, 6.4);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const ambient = new THREE.AmbientLight(0x141009, 0.72);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0x624019, 0.68);
      key.position.set(2.6, 2.4, 2.2);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x1b0f07, 0.42);
      rim.position.set(-2.3, -1.7, -2.4);
      scene.add(rim);

      const rootGroup = new THREE.Group();
      rootGroup.name = "miner-root";
      rootGroup.position.set(0, 0.52, 0);
      scene.add(rootGroup);
      rootGroupRef.current = rootGroup;

      if (!particleTextureRef.current) {
        particleTextureRef.current = createParticleTexture(160);
      }

      let particleTexture = particleTextureRef.current;
      if (!particleTexture) {
        particleTexture = createParticleTexture(160);
        particleTextureRef.current = particleTexture;
      }

      const particleField = createParticleField(particleTexture);
      rootGroup.add(particleField.points);
      particleFieldRef.current = particleField;

      const streamField = createStreamField(particleTexture);
      rootGroup.add(streamField.points);
      streamFieldRef.current = streamField;

      const coins = createCoinMeshes();
      rootGroup.add(coins.gram);
      rootGroup.add(coins.gg);
      coinMeshesRef.current = coins;

      const halo = createHaloSprite(createHaloTexture(256));
      rootGroup.add(halo.sprite);
      haloRef.current = halo;

      const resize = () => {
        // Используем getBoundingClientRect для большей точности в iOS Telegram/WebView
        const rect = container.getBoundingClientRect();
        const width = Math.max(0, Math.floor(rect.width)) || window.innerWidth;
        const height = Math.max(0, Math.floor(rect.height)) || window.innerHeight;
        if (width <= 0 || height <= 0) return;

        // Ограничиваем DPR, чтобы избежать лишнего масштабирования и клиппинга на высоких DPI
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer?.setPixelRatio(dpr);
        renderer?.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        const distance = camera.position.z;
        const halfFovRad = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const worldHeight = 2 * Math.tan(halfFovRad) * distance;
        const worldWidth = worldHeight * camera.aspect;

        // Adaptive coefficient pushes coins further on wider screens
        const exitCoeff = Math.min(1.2, 0.72 + camera.aspect * 0.15);
        const entryX = -worldWidth * exitCoeff;
        const exitX = worldWidth * exitCoeff;
        viewportRef.current = { width: worldWidth, height: worldHeight, entryX, exitX };

        const rootGroup = rootGroupRef.current;
        if (rootGroup) {
          // Опускаем сферу ниже для симметричного вида
          const baseOffset = worldHeight * -0.12;
          const clampedOffset = THREE.MathUtils.clamp(baseOffset, -0.5, 0);
          rootGroup.position.setY(clampedOffset);
        }

        const sphereRadius = Math.min(1.42, Math.max(0.88, worldHeight * 0.18));
        const baseCoinScale = Math.min(1.32, Math.max(0.78, worldHeight / 5.6));
        baseCoinScaleRef.current = baseCoinScale;

        if (particleFieldRef.current) {
          particleFieldRef.current.radius = sphereRadius;
          particleFieldRef.current.material.size =
            0.05 * Math.min(1.8, Math.max(0.85, worldHeight / 4.8));
        }

        if (streamFieldRef.current) {
          const newSize = 0.072 * Math.min(1.7, Math.max(0.95, worldHeight / 4.6));
          streamFieldRef.current.material.size = newSize;
          streamFieldRef.current.shader.uniforms.uBaseSize.value = newSize;
        }

        if (haloRef.current) {
          haloRef.current.sprite.scale.setScalar(Math.max(1.2, sphereRadius * 1.4));
        }
      };

      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(resize);
        observer.observe(container);
      } else {
        window.addEventListener("resize", resize);
        resizeListenerAttached = true;
      }
      resize();

      const animate = () => {
        const now = getNow();
        const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = now;

        updateCohesion(dt);
        updateCoins(now, cycleMs, dt);
        updateParticles(now, dt);

        renderer?.render(scene as THREE.Scene, camera);
      };

      renderer.setAnimationLoop(animate);

      return () => {
        particleFieldRef.current = null;
        streamFieldRef.current = null;
        coinMeshesRef.current = null;
        haloRef.current = null;
        rootGroupRef.current = null;
        rendererRef.current = null;
        sceneRef.current = null;
        renderer?.setAnimationLoop(null);
        if (observer) {
          observer.disconnect();
        } else if (resizeListenerAttached) {
          window.removeEventListener("resize", resize);
        }
        if (renderer && renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
        renderer?.dispose();
        scene?.traverse((obj) => {
          if (
            obj instanceof THREE.Mesh ||
            obj instanceof THREE.Points ||
            obj instanceof THREE.Sprite
          ) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              for (const mat of obj.material) {
                mat.dispose();
              }
            } else {
              (obj.material as THREE.Material | undefined)?.dispose?.();
            }
          }
        });
      };
    } catch (error) {
      console.error("MinerScene: unable to initialise WebGL scene", error);
      rendererRef.current = null;
      sceneRef.current = null;
      particleFieldRef.current = null;
      streamFieldRef.current = null;
      coinMeshesRef.current = null;
      haloRef.current = null;
      rootGroupRef.current = null;
      if (renderer) {
        renderer.setAnimationLoop(null);
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
      }
      setFallback(true);
    }
  }, [cycleMs, fallback, updateCohesion, updateCoins, updateParticles]);

  if (fallback) {
    return (
      <div className="maining-fallback" role="img" aria-label="Static coin artwork">
        <span className="maining-fallback__halo" aria-hidden />
        <img src={ggTextureUrl} alt="" className="maining-fallback__logo" draggable={false} />
        <p className="maining-fallback__text">Your device does not support 3D animation.</p>
      </div>
    );
  }

  return <div ref={containerRef} className="maining-canvas" role="presentation" />;
}

function phaseWindow(value: number, start: number, length: number) {
  if (length <= 0) return null;
  const end = start + length;
  if (value < start || value > end) return null;
  return clamp01((value - start) / length);
}

function createParticleField(texture: THREE.Texture): ParticleField {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const attribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);

  const spherical = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT);
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const idx = i * 3;
    const u = Math.random();
    const v = Math.random();
    const theta = Math.acos(2 * u - 1);
    const phi = v * TWO_PI;
    const radius = 0.8 + Math.random() * 1.6;
    spherical[idx] = theta;
    spherical[idx + 1] = phi;
    spherical[idx + 2] = radius;
    seeds[i] = Math.random();
  }

  const material = new THREE.PointsMaterial({
    map: texture,
    color: new THREE.Color(0xf4c87d),
    size: 0.068,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  if (material.map) {
    material.map.anisotropy = 8;
  }

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 2;

  return { points, attribute, spherical, seeds, material, radius: 1.1 };
}

function createStreamField(texture: THREE.Texture): StreamField {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STREAM_COUNT * 3);
  const attribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);

  // Add per-particle size channel so we can fade streams smoothly
  const sizes = new Float32Array(STREAM_COUNT);
  for (let i = 0; i < STREAM_COUNT; i += 1) {
    sizes[i] = 1.0; // Start at full size before animation kicks in
  }
  const sizeAttribute = new THREE.BufferAttribute(sizes, 1);
  geometry.setAttribute("size", sizeAttribute);

  const offsets = new Float32Array(STREAM_COUNT);
  const seeds = new Float32Array(STREAM_COUNT * 3);
  for (let i = 0; i < STREAM_COUNT; i += 1) {
    offsets[i] = Math.random();
    const idx = i * 3;
    seeds[idx] = Math.random() * 2 - 1;
    seeds[idx + 1] = Math.random() * 2 - 1;
    seeds[idx + 2] = Math.random() * 2 - 1;
  }

  // Custom shader keeps unique sprite scale per particle
  const shader = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uColor: { value: new THREE.Color(0xf3d291) },
      uOpacity: { value: 0 },
      uBaseSize: { value: 0.078 },
    },
    vertexShader: `
      attribute float size;
      uniform float uBaseSize;
      varying float vAlpha;
      
      void main() {
        vAlpha = size;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uBaseSize * size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      
      void main() {
        vec4 texColor = texture2D(uTexture, gl_PointCoord);
        gl_FragColor = vec4(uColor, texColor.a * uOpacity * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  if (texture) {
    texture.anisotropy = 8;
  }

  const points = new THREE.Points(geometry, shader);
  points.visible = false;
  points.frustumCulled = false;
  points.renderOrder = 11;

  // Bridge minimal PointsMaterial API expected by existing code paths
  const materialBridge = {} as THREE.PointsMaterial;
  Object.defineProperties(materialBridge, {
    color: {
      value: shader.uniforms.uColor.value as THREE.Color,
      writable: false,
      configurable: false,
    },
    opacity: {
      get() {
        return shader.uniforms.uOpacity.value as number;
      },
      set(value: number) {
        shader.uniforms.uOpacity.value = value;
      },
    },
    size: {
      get() {
        return shader.uniforms.uBaseSize.value as number;
      },
      set(value: number) {
        shader.uniforms.uBaseSize.value = value;
      },
    },
    map: {
      get() {
        return shader.uniforms.uTexture.value as THREE.Texture | null;
      },
      set(value: THREE.Texture | null) {
        shader.uniforms.uTexture.value = value;
      },
    },
  });

  return {
    points,
    attribute,
    offsets,
    seeds,
    material: materialBridge,
    sizes: sizeAttribute,
    shader,
  };
}

function createCoinMeshes(): CoinMeshes {
  const loader = new THREE.TextureLoader();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const gramMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const ggMaterial = gramMaterial.clone();

  loader.load(gramTextureUrl, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    gramMaterial.map = texture;
    gramMaterial.needsUpdate = true;
  });

  loader.load(ggTextureUrl, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    ggMaterial.map = texture;
    ggMaterial.needsUpdate = true;
  });

  const gram = new THREE.Mesh(geometry, gramMaterial);
  gram.visible = false;
  gram.renderOrder = 8;

  const gg = new THREE.Mesh(geometry.clone(), ggMaterial);
  gg.visible = false;
  gg.renderOrder = 9;

  return { gram, gg };
}

function createHaloSprite(texture: THREE.Texture): Halo {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: new THREE.Color(0xf9e7c3),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  if (material.map) {
    material.map.anisotropy = 8;
  }
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  sprite.position.set(0, 0, -0.03);
  sprite.scale.setScalar(1.2);
  sprite.renderOrder = 10;
  return { sprite, material };
}

function createParticleTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const cx = size / 2;
  const cy = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  gradient.addColorStop(0, "rgba(255, 233, 180, 0.95)");
  gradient.addColorStop(0.35, "rgba(230, 182, 110, 0.7)");
  gradient.addColorStop(0.75, "rgba(120, 70, 30, 0.16)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = size;
  blurCanvas.height = size;
  const blurCtx = blurCanvas.getContext("2d");
  if (blurCtx) {
    blurCtx.filter = "blur(3px)";
    blurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.filter = "blur(1.4px)";
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.filter = "none";
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createHaloTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const cx = size / 2;
  const cy = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  gradient.addColorStop(0, "rgba(255, 240, 200, 0.9)");
  gradient.addColorStop(0.35, "rgba(255, 220, 150, 0.55)");
  gradient.addColorStop(0.75, "rgba(210, 140, 70, 0.12)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function sampleEntryPath(t: number, viewport: ViewportMetrics, jitterX: number, jitterY: number) {
  const eased = clamp01(t);
  const base = getEntryBasePosition(eased, viewport);
  const attenuation = 1 - easeInOutCubic(eased) * 0.55;
  return {
    x: base.x + jitterX * viewport.width * 0.032 * attenuation,
    y: base.y + jitterY * viewport.height * 0.046 * attenuation,
    z: base.z,
  };
}

function sampleReleasePath(t: number, viewport: ViewportMetrics, jitterX: number, jitterY: number) {
  const eased = clamp01(t);
  const base = getReleaseBasePosition(eased, viewport);
  const releasePhase = eased < 0.65 ? eased / 0.65 : 1;
  const attenuation = 1 - easeInOutCubic(releasePhase) * 0.6;
  return {
    x: base.x + jitterX * viewport.width * 0.05 * attenuation,
    y: base.y + jitterY * viewport.height * 0.04 * attenuation,
    z: base.z,
  };
}

function getEntryBasePosition(t: number, viewport: ViewportMetrics) {
  const eased = easeInOutCubic(clamp01(t));
  const x = THREE.MathUtils.lerp(viewport.entryX, 0, eased);
  const y = Math.sin(eased * Math.PI) * viewport.height * 0.18 - eased * 0.12;
  const z = -0.08 + Math.cos(eased * Math.PI) * 0.06;
  return { x, y, z };
}

function getReleaseBasePosition(t: number, viewport: ViewportMetrics) {
  const clamped = clamp01(t);
  if (clamped <= 0.65) {
    const releaseT = clamped / 0.65;
    const arc = easeInOutCubic(releaseT);
    return {
      x: Math.sin(arc * Math.PI * 0.65) * viewport.width * 0.06,
      y: Math.sin(arc * Math.PI) * viewport.height * 0.14 - arc * 0.1,
      z: -0.04,
    };
  }

  const exitT = (clamped - 0.65) / 0.35;
  const arc = easeInOutCubic(exitT);
  const overshoot = easeOutBack(exitT);
  return {
    x: THREE.MathUtils.lerp(0, viewport.exitX, arc) + overshoot * 1.2,
    y: Math.sin((1 - arc) * Math.PI) * viewport.height * 0.12 - arc * 0.16,
    z: 0.08 + arc * 0.22,
  };
}

function getStreamTangent(mode: "entry" | "release", t: number, viewport: ViewportMetrics) {
  const delta = 0.003;
  const start = clamp01(Math.max(0, t - delta));
  const end = clamp01(Math.min(1, t + delta));
  if (Math.abs(end - start) < 1e-4) {
    return { x: 0, y: 0, z: -1 };
  }

  const p0 =
    mode === "entry"
      ? getEntryBasePosition(start, viewport)
      : getReleaseBasePosition(start, viewport);
  const p1 =
    mode === "entry" ? getEntryBasePosition(end, viewport) : getReleaseBasePosition(end, viewport);

  return { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
}
