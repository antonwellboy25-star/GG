import { useCallback, useEffect, useRef } from "react";
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

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const term = t - 1;
  return 1 + c3 * term * term * term + c1 * term * term;
};
const easeInSine = (t: number) => 1 - Math.cos((t * Math.PI) / 2);

const initialNow = typeof performance !== "undefined" ? performance.now() : Date.now();

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

export default function MinerScene({ active, cycleMs = DEFAULT_CYCLE }: MinerSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const particleFieldRef = useRef<ParticleField | null>(null);
  const streamFieldRef = useRef<StreamField | null>(null);
  const coinMeshesRef = useRef<CoinMeshes | null>(null);
  const haloRef = useRef<Halo | null>(null);
  const particleTextureRef = useRef<THREE.Texture | null>(null);

  const lastTimeRef = useRef(initialNow);
  const cohesionRef = useRef(active ? 1 : 0);
  const targetCohesionRef = useRef(active ? 1 : 0);

  const activeRef = useRef(active);
  const coinEnabledRef = useRef(false);
  const coinStartRef = useRef(initialNow);
  const viewportRef = useRef<ViewportMetrics | null>(null);
  const baseCoinScaleRef = useRef(1);

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
        stream.points.visible = false;
      }
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
    const cohesion = clamp(cohesionRef.current);
    const swirl = 1 - cohesion;

    const time = now * 0.00062;
    const band = now * 0.0011;

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const idx = i * 3;
      const theta = spherical[idx];
      const phi = spherical[idx + 1];
      const radial = spherical[idx + 2];
      const seed = seeds[i];

      const swirlRadius = radial + Math.sin(time * 1.35 + seed * 14.2) * 0.42;
      const swirlAngle = phi + time * (1.6 + seed * 0.9);
      const swirlTilt = Math.cos(time * 0.9 + seed * 12.4) * 0.55;

      const swirlX = swirlRadius * Math.cos(swirlAngle);
      const swirlY = swirlTilt + Math.sin(phi * 2.1 + time * 0.72) * 0.32;
      const swirlZ = swirlRadius * Math.sin(swirlAngle);

      const sinTheta = Math.sin(theta);
      const sphereX = sinTheta * Math.cos(phi);
      const sphereY = Math.cos(theta);
      const sphereZ = sinTheta * Math.sin(phi);
      const sphereRad = radius * (0.86 + seed * 0.18 + Math.sin(band + seed * 6.3) * 0.06);

      const targetX = sphereX * sphereRad;
      const targetY = sphereY * sphereRad;
      const targetZ = sphereZ * sphereRad;

      const blend = cohesion;
      const jitter = (1 - blend * 0.55) * 0.28;

      arr[idx] =
        THREE.MathUtils.lerp(swirlX, targetX, blend) + Math.sin(time * 3.6 + seed * 20.5) * jitter;
      arr[idx + 1] =
        THREE.MathUtils.lerp(swirlY, targetY, blend) +
        Math.cos(time * 2.8 + seed * 18.2) * jitter * 0.62;
      arr[idx + 2] =
        THREE.MathUtils.lerp(swirlZ, targetZ, blend) + Math.sin(time * 3.1 + seed * 16.7) * jitter;
    }

    attribute.needsUpdate = true;
    points.rotation.y += dt * (0.18 + swirl * 0.24);
    points.rotation.x = THREE.MathUtils.damp(points.rotation.x, cohesion * 0.22, 3.8, dt);
    material.opacity = THREE.MathUtils.lerp(0.48, 0.82, cohesion);
  }, []);

  const animateStream = useCallback((mode: "entry" | "release" | null, progress: number) => {
    const field = streamFieldRef.current;
    const viewport = viewportRef.current;
    if (!field || !viewport) return;

    const { attribute, offsets, seeds, material, points } = field;
    const arr = attribute.array as Float32Array;

    if (!mode || progress <= 0) {
      material.opacity = THREE.MathUtils.damp(material.opacity, 0, 7.8, 0.016);
      if (material.opacity < 0.03) {
        points.visible = false;
      }
      return;
    }

    points.visible = true;
    const eased = clamp(progress);
    const jitterPhase = eased * 6.2;
    material.color.setHex(mode === "entry" ? 0xf0b45a : 0xf8f1d0);
    const targetOpacity = mode === "entry" ? 0.55 + eased * 0.35 : 0.62 + eased * 0.38;
    material.opacity = THREE.MathUtils.damp(material.opacity, targetOpacity, 5.4, 0.016);
    material.size = THREE.MathUtils.damp(
      material.size,
      mode === "entry" ? 0.046 : 0.052,
      6.1,
      0.016,
    );

    for (let i = 0; i < STREAM_COUNT; i += 1) {
      const idx = i * 3;
      const offset = offsets[i];
      const local = clamp((eased * 1.22 - offset) / 1.06);
      const nX = seeds[idx];
      const nY = seeds[idx + 1];
      const nZ = seeds[idx + 2];

      if (local <= 0) {
        const start =
          mode === "entry"
            ? sampleEntryPath(0, viewport, nX, nY)
            : sampleReleasePath(0, viewport, nX, nY);
        arr[idx] = start.x;
        arr[idx + 1] = start.y;
        arr[idx + 2] = start.z;
        continue;
      }

      const sample =
        mode === "entry"
          ? sampleEntryPath(local, viewport, nX, nY)
          : sampleReleasePath(local, viewport, nX, nY);

      const jitter = mode === "entry" ? (1 - local) * 0.35 : Math.min(local * 0.8, 0.6);
      const sinJ = Math.sin(jitterPhase + nX * 8.3) * jitter * viewport.width * 0.02;
      const cosJ = Math.cos(jitterPhase + nY * 9.1) * jitter * viewport.height * 0.018;
      const depthJ = Math.sin(jitterPhase * 1.2 + nZ * 12.7) * jitter * 0.14;

      arr[idx] = sample.x + sinJ;
      arr[idx + 1] = sample.y + cosJ;
      arr[idx + 2] = sample.z + depthJ;
    }

    attribute.needsUpdate = true;
  }, []);

  const updateCoins = useCallback(
    (now: number, cycle: number) => {
      const meshes = coinMeshesRef.current;
      const viewport = viewportRef.current;
      if (!meshes || !viewport) return;

      const { gram, gg } = meshes;
      const gramMat = gram.material as THREE.MeshBasicMaterial;
      const ggMat = gg.material as THREE.MeshBasicMaterial;
      const camera = cameraRef.current;
      const halo = haloRef.current;

      if (camera) {
        gram.quaternion.copy(camera.quaternion);
        gg.quaternion.copy(camera.quaternion);
        if (halo) {
          halo.sprite.quaternion.copy(camera.quaternion);
        }
      }

      const cohesion = clamp(cohesionRef.current);
      const ready = cohesion > 0.68 && activeRef.current;
      if (ready && !coinEnabledRef.current) {
        coinEnabledRef.current = true;
        coinStartRef.current = now;
      }

      if (!coinEnabledRef.current) {
        gram.visible = false;
        gg.visible = false;
        gramMat.opacity = THREE.MathUtils.damp(gramMat.opacity, 0, 8, 0.016);
        ggMat.opacity = THREE.MathUtils.damp(ggMat.opacity, 0, 8, 0.016);
        animateStream(null, 0);
        if (halo) {
          halo.material.opacity = THREE.MathUtils.damp(halo.material.opacity, 0, 6.4, 0.016);
          const newScale = THREE.MathUtils.damp(halo.sprite.scale.x, 1.08, 6.4, 0.016);
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

      let streamMode: "entry" | "release" | null = null;
      let streamProgress = 0;
      let haloTargetOpacity = 0.18;
      let haloTargetScale = halo?.sprite.scale.x ?? 1.2;

      const entryPhase = phaseWindow(progress, 0, 0.26);
      if (entryPhase !== null) {
        const arc = easeInOutCubic(entryPhase);
        const eased = easeOutBack(entryPhase);
        const lift = Math.sin(arc * Math.PI) * viewport.height * 0.18;
        gram.visible = true;
        gg.visible = false;
        gram.position.set(
          THREE.MathUtils.lerp(viewport.entryX, 0, arc),
          lift - arc * 0.12,
          -0.08 + Math.cos(arc * Math.PI) * 0.06,
        );
        const scale = THREE.MathUtils.lerp(1.08, 0.9, eased);
        gram.scale.set(scale * baseScale, scale * baseScale, 1);
        gram.rotation.z = Math.sin(arc * TWO_PI) * 0.24;
        gram.rotation.y = Math.sin(arc * Math.PI * 0.8) * 0.2;
        gramMat.opacity = THREE.MathUtils.damp(gramMat.opacity, 1, 16, 0.016);
        streamMode = "entry";
        streamProgress = entryPhase;
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.24 + arc * 0.38);
        haloTargetScale = Math.max(haloTargetScale, 1.18 + arc * 0.35);
      } else {
        gramMat.opacity = THREE.MathUtils.damp(gramMat.opacity, 0, 8, 0.016);
        if (gramMat.opacity < 0.05) {
          gram.visible = false;
        }
      }

      const fusePhase = phaseWindow(progress, 0.26, 0.14);
      if (fusePhase !== null) {
        const blend = easeInOutCubic(fusePhase);
        gram.visible = true;
        gram.position.set(0, Math.sin((1 - blend) * Math.PI) * viewport.height * 0.06, -0.06);
        const scale = THREE.MathUtils.lerp(0.88, 0.32, blend);
        gram.scale.set(scale * baseScale, scale * baseScale, 1);
        gramMat.opacity = 1 - blend;
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.36 + blend * 0.48);
        haloTargetScale = Math.max(haloTargetScale, 1.36 + blend * 1.1);
      }

      const pulsePhase = phaseWindow(progress, 0.4, 0.18);
      if (pulsePhase !== null) {
        const wave = Math.sin(pulsePhase * Math.PI);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.52 + wave * 0.42);
        haloTargetScale = Math.max(haloTargetScale, 1.5 + wave * 0.68);
      }

      const releasePhase = phaseWindow(progress, 0.58, 0.16);
      if (releasePhase !== null) {
        const arc = easeInOutCubic(releasePhase);
        const ease = easeOutExpo(releasePhase);
        gg.visible = true;
        gg.position.set(
          Math.sin(arc * Math.PI * 0.65) * viewport.width * 0.06,
          Math.sin(arc * Math.PI) * viewport.height * 0.14 - arc * 0.1,
          -0.04,
        );
        gg.scale.setScalar(baseScale * (0.42 + ease * 0.8));
        gg.rotation.z = Math.sin(arc * TWO_PI) * 0.18;
        gg.rotation.y = Math.sin(arc * Math.PI * 0.7) * 0.16;
        ggMat.opacity = ease;
        streamMode = "release";
        streamProgress = Math.max(streamProgress, releasePhase);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.48 + ease * 0.5);
        haloTargetScale = Math.max(haloTargetScale, 1.48 + ease * 1.32);
      } else {
        ggMat.opacity = THREE.MathUtils.damp(ggMat.opacity, 0, 8, 0.016);
        if (ggMat.opacity < 0.05 && releasePhase === null) {
          gg.visible = false;
        }
      }

      const exitPhase = phaseWindow(progress, 0.74, 0.18);
      if (exitPhase !== null) {
        const arc = easeInOutCubic(exitPhase);
        const overshoot = easeOutBack(exitPhase);
        gg.visible = true;
        gg.position.set(
          THREE.MathUtils.lerp(0, viewport.exitX, arc) + overshoot * 0.32,
          Math.sin((1 - arc) * Math.PI) * viewport.height * 0.12 - arc * 0.16,
          0.08 + arc * 0.22,
        );
        gg.scale.setScalar(baseScale * (1.02 + arc * 0.26));
        gg.rotation.z = -Math.sin(arc * TWO_PI) * 0.22;
        streamMode = "release";
        streamProgress = Math.max(streamProgress, exitPhase);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.38 + arc * 0.32);
        haloTargetScale = Math.max(haloTargetScale, 1.26 + arc * 0.42);
      }

      const settlePhase = phaseWindow(progress, 0.92, 0.08);
      if (settlePhase !== null) {
        const delay = easeInSine(settlePhase);
        haloTargetOpacity = Math.max(haloTargetOpacity, 0.22 * (1 - delay));
        haloTargetScale = Math.max(haloTargetScale, 1.1 + delay * 0.2);
      }

      animateStream(streamMode, streamProgress);

      if (halo) {
        halo.sprite.visible = true;
        halo.material.opacity = THREE.MathUtils.damp(
          halo.material.opacity,
          haloTargetOpacity,
          5.6,
          0.016,
        );
        const newScale = THREE.MathUtils.damp(halo.sprite.scale.x, haloTargetScale, 5.4, 0.016);
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
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    camera.position.set(0, 0.2, 6.4);
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

    if (!particleTextureRef.current) {
      particleTextureRef.current = createParticleTexture(160);
    }

    let particleTexture = particleTextureRef.current;
    if (!particleTexture) {
      particleTexture = createParticleTexture(160);
      particleTextureRef.current = particleTexture;
    }

    const particleField = createParticleField(particleTexture);
    scene.add(particleField.points);
    particleFieldRef.current = particleField;

    const streamField = createStreamField(particleTexture);
    scene.add(streamField.points);
    streamFieldRef.current = streamField;

    const coins = createCoinMeshes();
    scene.add(coins.gram);
    scene.add(coins.gg);
    coinMeshesRef.current = coins;

    const halo = createHaloSprite(createHaloTexture(256));
    scene.add(halo.sprite);
    haloRef.current = halo;

    const resize = () => {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const distance = camera.position.z;
      const halfFovRad = THREE.MathUtils.degToRad(camera.fov * 0.5);
      const worldHeight = 2 * Math.tan(halfFovRad) * distance;
      const worldWidth = worldHeight * camera.aspect;
      const entryX = -worldWidth * 0.58;
      const exitX = worldWidth * 0.58;
      viewportRef.current = { width: worldWidth, height: worldHeight, entryX, exitX };

      const sphereRadius = Math.min(1.42, Math.max(0.88, worldHeight * 0.18));
      const baseCoinScale = Math.min(1.32, Math.max(0.78, worldHeight / 5.6));
      baseCoinScaleRef.current = baseCoinScale;

      if (particleFieldRef.current) {
        particleFieldRef.current.radius = sphereRadius;
        particleFieldRef.current.material.size =
          0.05 * Math.min(1.8, Math.max(0.85, worldHeight / 4.8));
      }

      if (streamFieldRef.current) {
        streamFieldRef.current.material.size =
          0.048 * Math.min(1.6, Math.max(0.9, worldHeight / 5.6));
      }

      if (haloRef.current) {
        haloRef.current.sprite.scale.setScalar(Math.max(1.2, sphereRadius * 1.4));
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const animate = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      updateCohesion(dt);
      updateParticles(now, dt);
      updateCoins(now, cycleMs);

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    return () => {
      particleFieldRef.current = null;
      streamFieldRef.current = null;
      coinMeshesRef.current = null;
      haloRef.current = null;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.traverse((obj) => {
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
  }, [cycleMs, updateCohesion, updateCoins, updateParticles]);

  return <div ref={containerRef} className="maining-canvas" role="presentation" />;
}

function phaseWindow(value: number, start: number, length: number) {
  if (length <= 0) return null;
  const end = start + length;
  if (value < start || value > end) return null;
  return clamp((value - start) / length);
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
    size: 0.052,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
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

  const offsets = new Float32Array(STREAM_COUNT);
  const seeds = new Float32Array(STREAM_COUNT * 3);
  for (let i = 0; i < STREAM_COUNT; i += 1) {
    offsets[i] = Math.random();
    const idx = i * 3;
    seeds[idx] = Math.random() * 2 - 1;
    seeds[idx + 1] = Math.random() * 2 - 1;
    seeds[idx + 2] = Math.random() * 2 - 1;
  }

  const material = new THREE.PointsMaterial({
    map: texture,
    color: new THREE.Color(0xf3d291),
    size: 0.045,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  if (material.map) {
    material.map.anisotropy = 8;
  }

  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.renderOrder = 6;

  return { points, attribute, offsets, seeds, material };
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
  const eased = easeInOutCubic(clamp(t));
  const x =
    THREE.MathUtils.lerp(viewport.entryX, 0, eased) +
    jitterX * viewport.width * 0.04 * (1 - eased * 0.6);
  const y =
    Math.sin(eased * Math.PI) * viewport.height * 0.22 +
    jitterY * viewport.height * 0.05 * (1 - eased * 0.3);
  const z = -0.12 + Math.cos(eased * Math.PI) * 0.08;
  return { x, y, z };
}

function sampleReleasePath(t: number, viewport: ViewportMetrics, jitterX: number, jitterY: number) {
  const eased = easeInOutCubic(clamp(t));
  const x =
    THREE.MathUtils.lerp(0, viewport.exitX, eased) +
    jitterX * viewport.width * 0.045 * (1 - eased * 0.4);
  const y =
    Math.sin((1 - eased) * Math.PI * 0.8) * viewport.height * 0.18 +
    jitterY * viewport.height * 0.04 * (1 - eased * 0.2) -
    eased * viewport.height * 0.05;
  const z = -0.04 + eased * 0.26;
  return { x, y, z };
}
