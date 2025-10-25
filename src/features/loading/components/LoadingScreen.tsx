import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
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

type LoadingScreenProps = {
  durationMs?: number;
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

const DEFAULT_DURATION = 5000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.14, "rgba(255, 243, 213, 0.82)");
    gradient.addColorStop(0.5, "rgba(240, 204, 130, 0.36)");
    gradient.addColorStop(1, "rgba(18, 18, 18, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 1;
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
    innerRadius: { value: 0.935 },
    colorA: { value: new Color(0xffffff) },
    colorB: { value: new Color(0xf8f8f8) },
    glow: { value: 0.42 },
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
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float progress;
      uniform float innerRadius;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float glow;
      uniform float opacity;
      const float PI = 3.141592653589793;

      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float radius = length(centered);
        if (radius < innerRadius || radius > 1.0) {
          discard;
        }

        float angle = atan(centered.y, centered.x);
        angle = (angle + PI) / (2.0 * PI);
        
        // Allow full circle completion
        if (angle > progress && progress < 0.999) {
          discard;
        }

  float band = smoothstep(progress - 0.03, progress, angle);
  float edgeInner = smoothstep(innerRadius, innerRadius + 0.022, radius);
  float edgeOuter = 1.0 - smoothstep(0.975, 1.0, radius);
        float edge = clamp(edgeInner * edgeOuter, 0.0, 1.0);
        vec3 color = mix(colorA, colorB, clamp(angle * 0.5, 0.0, 1.0));
  float head = band * 0.43;
  float alpha = edge * (0.78 + glow * 0.2) * opacity;
        alpha += head * opacity;
        if (alpha <= 0.0) {
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
    size: tier === "high" ? 0.034 : tier === "mid" ? 0.042 : 0.05,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    opacity: 0,
    blending: AdditiveBlending,
    color: new Color(0xf4ddb2),
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

export default function LoadingScreen({
  durationMs = DEFAULT_DURATION,
  onDone,
}: LoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [texture, setTexture] = useState<Texture | null>(null);
  const [visible, setVisible] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [canRender, setCanRender] = useState<boolean | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const tierRef = useRef<PerfTier>("mid");
  const reduceMotion = usePrefersReducedMotion();
  const fallbackStyle = { ["--loader-duration" as const]: `${durationMs}ms` } as CSSProperties;

  useEffect(() => {
    tierRef.current = detectPerfTier();
    setCanRender(isWebGLAvailable());
  }, []);

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
    if (!sceneReady) return;
    const timer = window.setTimeout(() => {
      onDone?.();
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [sceneReady, durationMs, onDone]);

  useEffect(() => {
    if (fallback || !containerRef.current || !texture || canRender !== true) return;

    const container = containerRef.current;
    const tier = tierRef.current;
    const durationSeconds = durationMs / 1000;
    const safeDuration = Math.max(durationSeconds, 0.001);
    const progressLead = Math.min(0.35, safeDuration * 0.1);
    const fadeOutWindow = Math.min(0.6, safeDuration * 0.18);
    const fadeOutStart = Math.max(0, safeDuration - fadeOutWindow + progressLead * 0.75);

    const renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });

    const camera = new PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0, 6.2);

    const scene = new Scene();
    scene.background = new Color(0x000000);
    scene.fog = new Fog(0x020202, 10, 28);

    const pixelRatioCap = tier === "high" ? 1.8 : tier === "mid" ? 1.45 : 1.15;
    const applySizing = () => {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.autoClearColor = true;
    renderer.domElement.classList.add("loader-stage__canvas");
    container.appendChild(renderer.domElement);

    applySizing();
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

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

    const logoGeometry = new PlaneGeometry(1, 1);
    const logoMaterial = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      alphaTest: 0.5,
    });
    const logoMesh = new Mesh(logoGeometry, logoMaterial);
    logoMesh.position.z = 0.2;
    logoMesh.renderOrder = 10;
    scene.add(logoMesh);

    const { material: ringMaterial, uniforms: ringUniforms } = createRingMaterial();
    ringMaterial.depthTest = false;
    ringMaterial.depthWrite = false;
    ringMaterial.transparent = true;
    const ringGeometry = new CircleGeometry(1, 512);
    const ringMesh = new Mesh(ringGeometry, ringMaterial);
    ringMesh.scale.setScalar(1.0);
    ringMesh.position.z = 0.24;
    ringMesh.renderOrder = 20;
    scene.add(ringMesh);

    // Compute tight alpha bounds of the image to remove padding
    const computeAlphaBounds = (img: HTMLImageElement) => {
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
      let minX = sw,
        minY = sh,
        maxX = -1,
        maxY = -1;
      const threshold = 20;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const a = data[(y * sw + x) * 4 + 3];
          if (a > threshold) {
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

    const bounds = computeAlphaBounds(texture.image as HTMLImageElement);

    const handleResize = () => {
      applySizing();
      // Compute world-space camera plane size
      const camZ = Math.abs(camera.position.z);
      const worldH = 2 * Math.tan(MathUtils.degToRad(camera.fov * 0.5)) * camZ;
      const worldW = worldH * camera.aspect;
      const isPortrait = worldH > worldW;
      const heightFrac = isPortrait ? 0.38 : 0.32; // larger coin
      const desiredH = worldH * heightFrac;
      const desiredW = Math.min(worldW * 0.68, desiredH * texAspect);
      const finalH = desiredW / (texAspect || 1);
      logoMesh.scale.set(desiredW, finalH, 1);

      // Tight content size without transparent padding
      const contentW = Math.max(0.001, (bounds.uMax - bounds.uMin) * desiredW);
      const contentH = Math.max(0.001, (bounds.vMax - bounds.vMin) * finalH);
      // Ring radius exactly at coin edge (half of the larger dimension)
      const ringRadius = 0.5 * Math.max(contentW, contentH) * 1.0;
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
      const clampedElapsed = clamp(elapsed, 0, safeDuration);
      const progress = clamp((clampedElapsed + progressLead) / safeDuration, 0, 1);
      const fadeIn = easeOutQuint(clamp(elapsed / 1.05, 0, 1));
      const fadeOut =
        elapsed < fadeOutStart
          ? 1
          : easeOutQuint(clamp(1 - (elapsed - fadeOutStart) / fadeOutWindow, 0, 1));
      const intensity = fadeIn * fadeOut;

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
      ringUniforms.glow.value = 0.4 + Math.sin(elapsed * 3.0) * 0.3;
      ringUniforms.opacity.value = intensity;

      renderer.render(scene, camera);

      if (elapsed < safeDuration + 0.8) {
        rafId = window.requestAnimationFrame(renderFrame);
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
  }, [fallback, texture, canRender, durationMs, reduceMotion]);

  return (
    <div className={`loader-root ${visible ? "loader-root--visible" : ""}`} aria-hidden>
      <div ref={containerRef} className="loader-stage" />
      {(fallback || canRender === false) && (
        <div className="loader-fallback" style={fallbackStyle}>
          <svg className="loader-fallback__ring" viewBox="0 0 120 120" aria-hidden>
            <title>Loading indicator</title>
            <defs>
              <linearGradient id="loader-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e9e9e9" />
              </linearGradient>
            </defs>
            <circle className="loader-fallback__track" cx="60" cy="60" r="52" />
            <circle className="loader-fallback__progress" cx="60" cy="60" r="52" />
          </svg>
          <img src={ggLogoUrl} alt="" className="loader-fallback__logo" draggable={false} />
        </div>
      )}
    </div>
  );
}
