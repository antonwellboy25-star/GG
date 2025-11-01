import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Fog,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SRGBColorSpace,
  Scene,
  TextureLoader,
  WebGLRenderer,
} from "three";
import type { Texture } from "three";
import ggLogoUrl from "@/assets/images/GG.png";
import { loadInitialResources } from "@/shared/utils/assetLoader";

type LoadingScreenProps = {
  onDone?: () => void;
};

type PerfTier = "low" | "mid" | "high";

type DustField = {
  geometry: BufferGeometry;
  material: PointsMaterial;
  points: Points;
  positions: Float32Array;
  baseAngles: Float32Array;
  radii: Float32Array;
  yOffsets: Float32Array;
  zOffsets: Float32Array;
  speed: Float32Array;
  wobble: Float32Array;
  baseOpacity: number;
};

const ASSET_WEIGHT = 0.82;
const SCENE_WEIGHT = 1 - ASSET_WEIGHT;
const DISPLAY_LERP = 0.16;
const PROGRESS_EPSILON = 0.002;
const FADE_OUT_WINDOW = 0.7;
const FALLBACK_RADIUS = 52;
const FALLBACK_CIRCUMFERENCE = 2 * Math.PI * FALLBACK_RADIUS;
const MIN_INTRO_DURATION = 5000;
const getNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const easeOutQuint = (value: number) => 1 - (1 - value) ** 5;

const isWebGLAvailable = () => {
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

const detectPerfTier = (): PerfTier => {
  try {
    const navigatorRef = navigator as Navigator & {
      hardwareConcurrency?: number;
      deviceMemory?: number;
    };

    const cores = navigatorRef.hardwareConcurrency ?? 4;
    const memory = navigatorRef.deviceMemory ?? 8;
    const area = window.innerWidth * window.innerHeight;
    const reduceMotion = matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (reduceMotion) return "low";
    if (cores <= 4 || memory <= 4 || area > 4_200_000) return "low";
    if (cores <= 8 || memory <= 6 || area > 2_700_000) return "mid";
    return "high";
  } catch {
    return "mid";
  }
};

const createDustTexture = () => {
  const size = 256; // Higher resolution keeps particles crisp
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: false });

  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255, 240, 200, 1)");
    gradient.addColorStop(0.12, "rgba(255, 235, 180, 0.88)");
    gradient.addColorStop(0.35, "rgba(255, 220, 140, 0.52)");
    gradient.addColorStop(0.65, "rgba(240, 200, 100, 0.18)");
    gradient.addColorStop(1, "rgba(20, 18, 15, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 16; // Placeholder, clamped to renderer capability later
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

type RingBundle = {
  material: ShaderMaterial;
  uniforms: {
    progress: { value: number };
    innerRadius: { value: number };
    colorA: { value: Color };
    colorB: { value: Color };
    glow: { value: number };
    opacity: { value: number };
  };
};

const createRingMaterial = (): RingBundle => {
  const uniforms = {
    progress: { value: 0 },
    innerRadius: { value: 0.92 }, // Slightly tighter interior for sharper edge
    colorA: { value: new Color(0xffffff) }, // Primary highlight
    colorB: { value: new Color(0xe8e8e8) }, // Secondary accent
    glow: { value: 0.5 },
    opacity: { value: 1.0 },
  };

  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vPosition;
  void main() {
        vUv = uv;
        vPosition = position.xy;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec2 vPosition;
      uniform float progress;
      uniform float innerRadius;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float glow;
      uniform float opacity;
      const float PI = 3.141592653589793;

      float aastep(float threshold, float value) {
        float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
        return smoothstep(threshold - afwidth, threshold + afwidth, value);
      }

      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float radius = length(centered);

        float ringThickness = 0.075;
        float outerRadius = 1.0;

        float radiusDeriv = length(vec2(dFdx(radius), dFdy(radius)));
        float aaWidth = radiusDeriv * 3.5;

        float innerEdge = smoothstep(innerRadius - aaWidth * 1.5, innerRadius + aaWidth * 1.5, radius);
        float outerEdge = 1.0 - smoothstep(outerRadius - aaWidth * 1.5, outerRadius + aaWidth * 1.5, radius);

        if (innerEdge < 0.005 || outerEdge < 0.005) {
          discard;
        }

  float angle = atan(centered.y, centered.x);
  angle = (angle + PI) / (2.0 * PI);

  // Лёгкое «оверфилл» на субпиксель, чтобы гарантированно закрыть шов
  float p = min(progress + 0.003, 1.0);

        float angleDeriv = length(vec2(dFdx(angle), dFdy(angle)));
        float angleAA = angleDeriv * 4.0;
        float progressEdge = 1.0 - smoothstep(p - angleAA, p + angleAA, angle);

        // Когда прогресс близок к 100%, убираем щель стыка и рисуем полный круг
        if (p >= 0.975) {
          progressEdge = 1.0;
        }

        if (progressEdge < 0.005 && p < 0.999) {
          discard;
        }

  float headWidth = 0.16;
        float angleDistance = p - angle;

        float normalizedDist = angleDistance / headWidth;

        float radialDist = length(vec2(normalizedDist, (radius - (innerRadius + 1.0) * 0.5) * 12.0));

        float band = 1.0 - smoothstep(0.0, 0.85, radialDist);
        band = pow(band, 4.0);

        if (p >= 0.97 || angleDistance < 0.0 || angleDistance > headWidth) {
          band = 0.0;
        }

        float midRadius = (innerRadius + outerRadius) * 0.5;
        float normalizedRadius = (radius - midRadius) / (ringThickness * 0.5);

        float thicknessProfile = 1.0 - abs(normalizedRadius);
        thicknessProfile = smoothstep(0.0, 1.0, thicknessProfile);
        thicknessProfile = thicknessProfile * thicknessProfile;

        float edgeMask = innerEdge * outerEdge;
        edgeMask = pow(edgeMask, 1.5);

  // Периодическая цветовая модуляция, чтобы не было скачка по цвету на стыке (angle=0 ~ angle=1)
  float cyc = 0.5 + 0.5 * cos(angle * 2.0 * PI);
  float hueMix = 0.35 + 0.45 * cyc; // диапазон [0.35, 0.80]
  vec3 baseColor = mix(colorA, colorB, hueMix);

        vec3 glowColor = vec3(1.0, 1.0, 1.0);
        vec3 color = mix(baseColor, glowColor, band * 0.5);

        float radialGradient = smoothstep(0.0, 1.0, thicknessProfile);
        radialGradient = mix(0.75, 1.0, radialGradient);
        color = color * radialGradient;

        float baseAlpha = edgeMask * (0.88 + glow * 0.12) * opacity;
        float headGlow = band * 0.65 * opacity;
        float alpha = baseAlpha + headGlow;

        float innerGlowRange = aaWidth * 3.0;
        float outerGlowRange = aaWidth * 3.0;

        float innerGlow = smoothstep(innerRadius, innerRadius + innerGlowRange, radius) * 
                          smoothstep(innerRadius + innerGlowRange * 2.0, innerRadius + innerGlowRange, radius) * 0.25;
        float outerGlow = smoothstep(outerRadius, outerRadius - outerGlowRange, radius) * 
                          smoothstep(outerRadius - outerGlowRange * 2.0, outerRadius - outerGlowRange, radius) * 0.25;

        alpha += (innerGlow + outerGlow) * opacity;

        alpha *= mix(0.85, 1.0, thicknessProfile);

        if (alpha <= 0.005) {
          discard;
        }

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  return { material, uniforms };
};

const buildDustField = (tier: PerfTier, reduceMotion: boolean): DustField => {
  const count = reduceMotion ? 380 : tier === "high" ? 1400 : tier === "mid" ? 1020 : 720;
  const geometry = new BufferGeometry();
  const positions = new Float32Array(count * 3);
  const baseAngles = new Float32Array(count);
  const radii = new Float32Array(count);
  const yOffsets = new Float32Array(count);
  const zOffsets = new Float32Array(count);
  const speed = new Float32Array(count);
  const wobble = new Float32Array(count);

  const minRadius = 1.8;
  const maxRadius = tier === "high" ? 4.2 : tier === "mid" ? 3.6 : 3.05;
  const verticalSpread = reduceMotion ? 0.9 : 1.7;
  const depthSpread = tier === "high" ? 1.8 : tier === "mid" ? 1.4 : 1.1;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = MathUtils.lerp(minRadius, maxRadius, Math.random());
    const y = (Math.random() - 0.5) * verticalSpread;
    const z = (Math.random() - 0.5) * depthSpread;

    const idx = i * 3;
    positions[idx] = Math.cos(angle) * radius;
    positions[idx + 1] = y;
    positions[idx + 2] = Math.sin(angle) * radius + z;

    baseAngles[i] = angle;
    radii[i] = radius;
    yOffsets[i] = y;
    zOffsets[i] = z;
    speed[i] = MathUtils.lerp(reduceMotion ? 0.12 : 0.2, reduceMotion ? 0.3 : 0.56, Math.random());
    wobble[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute("position", new BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    size: tier === "high" ? 0.038 : tier === "mid" ? 0.045 : 0.052,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    opacity: 0,
    blending: AdditiveBlending,
    color: new Color(0xffedb8), // Warm golden hue for dust
    map: createDustTexture(),
  });

  if (material.map) {
    material.map.center.set(0.5, 0.5);
    material.map.needsUpdate = true;
  }

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  return {
    geometry,
    material,
    points,
    positions,
    baseAngles,
    radii,
    yOffsets,
    zOffsets,
    speed,
    wobble,
    baseOpacity: reduceMotion ? 0.28 : tier === "high" ? 0.58 : 0.5,
  };
};

type AlphaBounds = { uMin: number; uMax: number; vMin: number; vMax: number };

const computeAlphaBounds = (img?: HTMLImageElement | null): AlphaBounds => {
  if (!img) return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
  const maxDim = 512;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
  const scale = Math.min(1, maxDim / Math.max(iw, ih));
  const sw = Math.max(1, Math.round(iw * scale));
  const sh = Math.max(1, Math.round(ih * scale));
  const off = document.createElement("canvas");
  off.width = sw;
  off.height = sh;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
  ctx.clearRect(0, 0, sw, sh);
  ctx.drawImage(img, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;
  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;
  const threshold = 20;
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const alpha = data[(y * sw + x) * 4 + 3];
      if (alpha > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
  return {
    uMin: minX / sw,
    uMax: (maxX + 1) / sw,
    vMin: minY / sh,
    vMax: (maxY + 1) / sh,
  };
};

const usePrefersReducedMotion = () => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const handleChange = () => setReduceMotion(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reduceMotion;
};

export default function LoadingScreen({ onDone }: LoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [texture, setTexture] = useState<Texture | null>(null);
  const [visible, setVisible] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [canRender, setCanRender] = useState<boolean | null>(null);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [fallbackProgressState, setFallbackProgressState] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const tierRef = useRef<PerfTier>("mid");
  const assetProgressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const displayProgressRef = useRef(0);
  const readyTimestampRef = useRef<number | null>(null);
  const sceneReadyRef = useRef(false);
  const assetsLoadedRef = useRef(false);
  const doneRef = useRef(false);
  const fallbackActiveRef = useRef(false);
  const fallbackProgressRef = useRef(0);
  const visibleAtRef = useRef<number | null>(null);
  const reduceMotion = usePrefersReducedMotion();

  const fallbackActive = fallback || canRender === false;

  const getGateFactor = useCallback(() => {
    const visibleSince = visibleAtRef.current;
    if (visibleSince == null) return 1;
    const elapsed = getNow() - visibleSince;
    return MathUtils.clamp(elapsed / MIN_INTRO_DURATION, 0, 1);
  }, []);

  const gateProgress = useCallback(
    (value: number) => Math.min(MathUtils.clamp(value, 0, 1), getGateFactor()),
    [getGateFactor],
  );

  const commitFallbackProgress = useCallback(
    (value: number) => {
      const limited = gateProgress(value);
      if (Math.abs(fallbackProgressRef.current - limited) < PROGRESS_EPSILON) return;
      fallbackProgressRef.current = limited;
      setFallbackProgressState(limited);
    },
    [gateProgress],
  );

  const computeTargetProgress = useCallback(
    (assetValue: number, sceneValue: boolean) =>
      MathUtils.clamp(assetValue * ASSET_WEIGHT + (sceneValue ? SCENE_WEIGHT : 0), 0, 1),
    [],
  );

  const updateTargetProgress = useCallback(
    (assetValue = assetProgressRef.current, sceneValue = sceneReadyRef.current) => {
      const next = computeTargetProgress(assetValue, sceneValue);
      targetProgressRef.current = next;
      if (fallbackActiveRef.current) {
        commitFallbackProgress(next);
      }
      return next;
    },
    [commitFallbackProgress, computeTargetProgress],
  );

  useEffect(() => {
    sceneReadyRef.current = sceneReady;
    updateTargetProgress();
  }, [sceneReady, updateTargetProgress]);

  useEffect(() => {
    assetsLoadedRef.current = assetsLoaded;
  }, [assetsLoaded]);

  useEffect(() => {
    fallbackActiveRef.current = fallbackActive;
    if (fallbackActive) {
      commitFallbackProgress(targetProgressRef.current);
    }
  }, [fallbackActive, commitFallbackProgress]);

  useEffect(() => {
    if (!fallbackActive) return;
    if (typeof window === "undefined") return;

    let raf = 0;
    const step = () => {
      if (doneRef.current) return;
      const target = gateProgress(targetProgressRef.current);
      const prev = fallbackProgressRef.current;
      const delta = target - prev;
      let next = prev + delta * DISPLAY_LERP;
      if (Math.abs(delta) < PROGRESS_EPSILON) next = target;
      next = MathUtils.clamp(next, 0, 1);
      if (Math.abs(fallbackProgressRef.current - next) >= PROGRESS_EPSILON) {
        fallbackProgressRef.current = next;
        setFallbackProgressState(next);
      }
      raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [fallbackActive, gateProgress]);

  useEffect(() => {
    tierRef.current = detectPerfTier();
    setCanRender(isWebGLAvailable());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const controller = new AbortController();

    loadInitialResources(
      (value) => {
        if (controller.signal.aborted) return;
        assetProgressRef.current = value;
        updateTargetProgress(value, sceneReadyRef.current);
      },
      { signal: controller.signal },
    )
      .then(() => {
        if (!controller.signal.aborted) {
          setAssetsLoaded(true);
        }
      })
      .catch((error) => {
        if ((error as DOMException)?.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        setAssetsLoaded(true);
      });

    return () => controller.abort();
  }, [updateTargetProgress]);

  useEffect(() => {
    let cancelled = false;
    const loader = new TextureLoader();

    loader.load(
      ggLogoUrl,
      (loaded) => {
        if (cancelled) return;
        loaded.colorSpace = SRGBColorSpace;
        loaded.anisotropy = 1;
        loaded.generateMipmaps = true;
        loaded.premultiplyAlpha = true;
        loaded.needsUpdate = true;
        setTexture(loaded);
      },
      undefined,
      () => {
        if (cancelled) return;
        setFallback(true);
        setSceneReady(true);
        setVisible(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (canRender === false) {
      setSceneReady(true);
      setVisible(true);
    }
  }, [canRender]);

  useEffect(() => {
    if (!sceneReady) return;
    const raf = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(raf);
  }, [sceneReady]);

  useEffect(() => {
    if (!visible) return;
    if (visibleAtRef.current != null) return;
    const now = getNow();
    visibleAtRef.current = now;
    displayProgressRef.current = 0;
    fallbackProgressRef.current = 0;
    if (fallbackActiveRef.current) {
      setFallbackProgressState(0);
    }
  }, [visible]);

  // Monitor completion for the fallback path as well and finish only when visually complete
  useEffect(() => {
    if (!fallbackActive) return;
    let raf = 0;
    const poll = () => {
      if (doneRef.current) return;
      const gate = getGateFactor();
      const isReady = assetsLoadedRef.current && sceneReadyRef.current && gate >= 1;
      const visual = MathUtils.clamp(fallbackProgressRef.current, 0, 1);
      if (isReady && visual >= 0.999) {
        doneRef.current = true;
        setTimeout(() => onDone?.(), 0);
        return;
      }
      raf = window.requestAnimationFrame(poll);
    };
    raf = window.requestAnimationFrame(poll);
    return () => window.cancelAnimationFrame(raf);
  }, [fallbackActive, getGateFactor, onDone]);

  useEffect(() => {
    if (fallbackActive || !containerRef.current || !texture || canRender !== true) return;

    const container = containerRef.current;
    const tier = tierRef.current;
    const fadeOutSeconds = FADE_OUT_WINDOW;

    const renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      depth: true,
      premultipliedAlpha: true,
    });

    const camera = new PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0, 6.2);

    const scene = new Scene();
    scene.background = new Color(0x000000);
    scene.fog = new Fog(0x020202, 10, 28);

    const pixelRatioCap = tier === "high" ? 2.5 : tier === "mid" ? 2.0 : 1.75; // Cap high DPI to protect performance
    const applySizing = () => {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.autoClearColor = true;
    renderer.sortObjects = true; // Maintain correct ordering for translucency
    renderer.domElement.classList.add("loader-stage__canvas");
    container.appendChild(renderer.domElement);

    applySizing();

    // Use maximum anisotropy for crisp textures
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.anisotropy = maxAnisotropy;

    const dustNear = buildDustField(tier, reduceMotion);
    const dustFar = buildDustField(tier, reduceMotion);
    // Adjust far field parameters to be finer and slower
    dustFar.material.size *= 0.55;
    dustFar.material.opacity *= 0.75;
    dustFar.points.position.z = -1.5;
    dustNear.points.position.z = -0.5;
    scene.add(dustFar.points);
    scene.add(dustNear.points);

    const imageSource = texture.image as { width: number; height: number } | undefined;
    const texAspect = imageSource?.height ? imageSource.width / imageSource.height : 1;

    const logoGeometry = new PlaneGeometry(1, 1, 64, 64); // Dense mesh keeps edge smooth
    const logoMaterial = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      alphaTest: 0.01, // Light alpha test avoids halo artifacts
    });
    const logoMesh = new Mesh(logoGeometry, logoMaterial);
    logoMesh.position.z = 0.2;
    logoMesh.renderOrder = 10;

    logoMaterial.toneMapped = false;

    scene.add(logoMesh);

    const { material: ringMaterial, uniforms: ringUniforms } = createRingMaterial();
    ringMaterial.depthTest = false;
    ringMaterial.depthWrite = false;
    ringMaterial.transparent = true;
    const ringGeometry = new CircleGeometry(1, 256); // High segment count for smooth arc
    const ringMesh = new Mesh(ringGeometry, ringMaterial);
    ringMesh.scale.setScalar(1.0);
    ringMesh.position.z = 0.25; // Slightly in front of the coin
    ringMesh.renderOrder = 20;
    scene.add(ringMesh);

    const bounds = computeAlphaBounds(texture.image as HTMLImageElement);

    const handleResize = () => {
      applySizing();
      // Compute world-space camera plane size
      const camZ = Math.abs(camera.position.z);
      const worldH = 2 * Math.tan(MathUtils.degToRad(camera.fov * 0.5)) * camZ;
      const worldW = worldH * camera.aspect;
      const isPortrait = worldH > worldW;
      const heightFrac = isPortrait ? 0.42 : 0.36; // Slightly larger coin footprint
      const desiredH = worldH * heightFrac;
      const desiredW = Math.min(worldW * 0.72, desiredH * texAspect);
      const finalH = desiredW / (texAspect || 1);
      logoMesh.scale.set(desiredW, finalH, 1);

      // Tight content size without transparent padding
      const contentW = Math.max(0.001, (bounds.uMax - bounds.uMin) * desiredW);
      const contentH = Math.max(0.001, (bounds.vMax - bounds.vMin) * finalH);
      const ringRadius = 0.5 * Math.max(contentW, contentH) * 1.12; // Keep ring offset from coin edge
      ringMesh.scale.setScalar(ringRadius);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    let disposed = false;
    let rafId = 0;

    const renderFrame = (timestamp: number) => {
      if (disposed) return;
      if (startTimeRef.current == null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const fadeIn = easeOutQuint(MathUtils.clamp(elapsed / 1.05, 0, 1));

      const visibleSince = visibleAtRef.current;
      const gateFactor = getGateFactor();
      const target = Math.min(MathUtils.clamp(targetProgressRef.current, 0, 1), gateFactor);
      const previous = displayProgressRef.current;
      const delta = target - previous;
      let next = previous + delta * DISPLAY_LERP;
      if (Math.abs(delta) < PROGRESS_EPSILON) {
        next = target;
      }
      next = MathUtils.clamp(next, 0, 1);
      displayProgressRef.current = next;
      const progress = next;

      if (
        assetsLoadedRef.current &&
        sceneReadyRef.current &&
        readyTimestampRef.current == null &&
        visibleSince != null &&
        gateFactor >= 1
      ) {
        readyTimestampRef.current = timestamp;
      }

      const fadeOutElapsed =
        readyTimestampRef.current != null ? (timestamp - readyTimestampRef.current) / 1000 : 0;
      const fadeOutFactor =
        readyTimestampRef.current != null
          ? easeOutQuint(MathUtils.clamp(1 - fadeOutElapsed / fadeOutSeconds, 0, 1))
          : 1;

      const intensity = fadeIn * fadeOutFactor;

      const updateDust = (df: ReturnType<typeof buildDustField>, speedScale = 1) => {
        const { positions, baseAngles, radii, yOffsets, zOffsets, speed, wobble } = df;
        for (let i = 0; i < baseAngles.length; i += 1) {
          const idx = i * 3;
          const angle = baseAngles[i] + elapsed * speed[i] * speedScale;
          const wob = wobble[i];
          const radiusPulse = radii[i] + Math.sin(elapsed * 0.82 + wob) * 0.06;
          positions[idx] = Math.cos(angle) * radiusPulse;
          positions[idx + 1] = yOffsets[i] + Math.sin(elapsed * 1.28 + wob) * 0.08;
          positions[idx + 2] =
            Math.sin(angle) * radiusPulse + zOffsets[i] + Math.cos(elapsed * 0.92 + wob) * 0.06;
        }
        df.geometry.attributes.position.needsUpdate = true;
        df.points.rotation.y = elapsed * (reduceMotion ? 0.06 : 0.14) * speedScale;
        df.points.rotation.x = Math.sin(elapsed * 0.3) * (reduceMotion ? 0.012 : 0.035);
        df.material.opacity = df.baseOpacity * intensity;
      };

      updateDust(dustFar, 0.7);
      updateDust(dustNear, 1);

      ringUniforms.progress.value = progress;
      ringUniforms.glow.value = 0.5 + Math.sin(elapsed * 4.2) * 0.2;
      ringUniforms.opacity.value = intensity;

      logoMaterial.opacity = 0.95 + Math.sin(elapsed * 2.8) * 0.05;

      renderer.render(scene, camera);

      const shouldContinue =
        !assetsLoadedRef.current || !sceneReadyRef.current || progress < 0.999 || intensity > 0.02;

      if (shouldContinue) {
        rafId = window.requestAnimationFrame(renderFrame);
      } else if (!doneRef.current) {
        doneRef.current = true;
        setTimeout(() => onDone?.(), 0);
      }
    };

    renderer.render(scene, camera);
    setSceneReady(true);
    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      startTimeRef.current = null;
      readyTimestampRef.current = null;
      displayProgressRef.current = targetProgressRef.current;
      container.removeChild(renderer.domElement);
      renderer.dispose();
      dustNear.material.map?.dispose();
      dustNear.material.dispose();
      dustNear.geometry.dispose();
      dustFar.material.map?.dispose();
      dustFar.material.dispose();
      dustFar.geometry.dispose();
      logoGeometry.dispose();
      logoMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    };
  }, [fallbackActive, texture, canRender, reduceMotion, getGateFactor, onDone]);

  const clampedFallbackProgress = MathUtils.clamp(fallbackProgressState, 0, 1);
  const fallbackAlmostFull = clampedFallbackProgress >= 0.975;
  const fallbackStrokeOffset = FALLBACK_CIRCUMFERENCE * (1 - clampedFallbackProgress);

  return (
    <div className={`loader-root ${visible ? "loader-root--visible" : ""}`} aria-hidden>
      <div ref={containerRef} className="loader-stage" />
      {(fallback || canRender === false) && (
        <div className="loader-fallback">
          <svg className="loader-fallback__ring" viewBox="0 0 120 120" aria-hidden>
            <title>Loading indicator</title>
            <defs>
              <linearGradient id="loader-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="50%" stopColor="#f5f5f5" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#e8e8e8" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <circle className="loader-fallback__track" cx="60" cy="60" r="52" />
            <circle
              className="loader-fallback__progress"
              cx="60"
              cy="60"
              r="52"
              strokeLinecap={fallbackAlmostFull ? "butt" : "round"}
              style={{
                strokeDasharray: FALLBACK_CIRCUMFERENCE,
                strokeDashoffset: fallbackAlmostFull ? 0 : fallbackStrokeOffset,
              }}
            />
          </svg>
          <img src={ggLogoUrl} alt="" className="loader-fallback__logo" draggable={false} />
        </div>
      )}
    </div>
  );
}
