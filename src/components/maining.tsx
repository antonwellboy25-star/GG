import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

type MainingProps = {
  active: boolean;
  cycleMs?: number;
};

const ease = {
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  clamp: (v: number) => Math.min(Math.max(v, 0), 1),
};

export default function Maining({ active, cycleMs = 2800 }: MainingProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const lastRef = useRef<number>(performance.now());
  const startRef = useRef<number>(performance.now());
  const activeRef = useRef<boolean>(active);

  // Refs для элементов
  const sunRef = useRef<THREE.Mesh | null>(null);
  const coronaRef = useRef<THREE.Mesh | null>(null);
  const glowRef = useRef<THREE.Sprite | null>(null);
  const flareRef = useRef<THREE.Sprite | null>(null);
  const gramRef = useRef<THREE.Mesh | null>(null);
  const ggRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const particleSpeedsRef = useRef<Float32Array | null>(null);
  const particleTextureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    activeRef.current = active;
    if (active) startRef.current = performance.now();
  }, [active]);

  // Стабильные обновляющие функции для анимаций
  const updateSun = useCallback((now: number, dt: number) => {
    const sun = sunRef.current;
    const corona = coronaRef.current;
    const glow = glowRef.current;
    if (!sun || !corona || !glow) return;

    // Вращение сферы и короны
    sun.rotation.y += dt * 0.08;
    sun.rotation.x = Math.sin(now * 0.0003) * 0.15;
    corona.rotation.y -= dt * 0.05;
    corona.rotation.z += dt * 0.02;

    // Пульсация свечения
    const pulse = 1 + 0.06 * Math.sin(now * 0.004) + 0.04 * Math.sin(now * 0.0027);
    glow.scale.set(3.8 * pulse, 3.8 * pulse, 1);

    const glowMat = glow.material as THREE.SpriteMaterial;
    glowMat.opacity = THREE.MathUtils.damp(
      glowMat.opacity,
      activeRef.current ? 0.85 : 0.5,
      3.5,
      dt,
    );

    // Интенсивность эмиссии
    const sunMat = sun.material as THREE.MeshStandardMaterial;
    sunMat.emissiveIntensity = THREE.MathUtils.damp(
      sunMat.emissiveIntensity,
      activeRef.current ? 1.6 : 1.0,
      4,
      dt,
    );

    // Анимация текстуры
    if (sunMat.map) {
      sunMat.map.offset.x = (now * 0.00012) % 1;
      sunMat.map.offset.y = (now * 0.00008) % 1;
    }

    const coronaMat = corona.material as THREE.MeshBasicMaterial;
    coronaMat.opacity = THREE.MathUtils.damp(
      coronaMat.opacity,
      activeRef.current ? 0.75 : 0.45,
      3.8,
      dt,
    );
  }, []);

  const updateIdle = useCallback((dt: number) => {
    const gram = gramRef.current;
    const gg = ggRef.current;
    const flare = flareRef.current;

    if (gram) {
      const m = gram.material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.damp(m.opacity, 0, 5, dt);
      gram.visible = false;
    }
    if (gg) {
      const m = gg.material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.damp(m.opacity, 0, 5, dt);
      gg.visible = false;
    }
    if (flare) {
      const fm = flare.material as THREE.SpriteMaterial;
      fm.opacity = THREE.MathUtils.damp(fm.opacity, 0, 6, dt);
    }
  }, []);

  const updateCycle = useCallback(
    (now: number) => {
      const gram = gramRef.current;
      const gg = ggRef.current;
      const cam = cameraRef.current;
      const flare = flareRef.current;
      if (!gram || !gg || !cam) return;

      const elapsed = (now - startRef.current) % cycleMs;
      const p = ease.clamp(elapsed / cycleMs);

      // Синхронизация с камерой
      gram.quaternion.copy(cam.quaternion);
      gg.quaternion.copy(cam.quaternion);

      // Фаза 1: Падение GRAM к сфере (0-35%)
      if (p < 0.35) {
        const t = p / 0.35;
        const eased = ease.inQuad(t);
        const y = THREE.MathUtils.lerp(2.2, 0.05, eased);
        gram.visible = true;
        gg.visible = false;
        gram.position.set(0, y, 0.5);
        gram.scale.setScalar(1 + 0.08 * Math.sin(t * Math.PI));
        gram.rotation.z = 0.6 * Math.sin(t * Math.PI * 1.5);

        const m = gram.material as THREE.MeshBasicMaterial;
        m.opacity = THREE.MathUtils.lerp(1, 0.1, eased);

        if (flare) {
          const fm = flare.material as THREE.SpriteMaterial;
          fm.opacity = THREE.MathUtils.damp(fm.opacity, 0, 8, 0.016);
        }
      }
      // Фаза 2: Поглощение и вспышка (35-55%)
      else if (p < 0.55) {
        const t = (p - 0.35) / 0.2;
        gram.visible = false;
        gg.visible = false;

        if (flare) {
          const fm = flare.material as THREE.SpriteMaterial;
          const intensity = Math.sin(t * Math.PI);
          fm.opacity = intensity * 0.9;
          const s = 4.8 + intensity * 1.8;
          flare.scale.set(s, s, 1);
        }
      }
      // Фаза 3: Выброс GG из сферы (55-100%)
      else {
        const t = (p - 0.55) / 0.45;
        const eased = ease.outQuad(ease.clamp(t));
        const y = THREE.MathUtils.lerp(0.05, 2.2, eased);
        const sc = 0.7 + 0.5 * eased;

        gg.visible = true;
        gram.visible = false;
        gg.position.set(0, y, 0.5);
        gg.scale.set(sc, sc, 1);
        gg.rotation.z = -0.5 * Math.sin(t * Math.PI * 1.3);

        const m = gg.material as THREE.MeshBasicMaterial;
        if (t < 0.15) {
          m.opacity = ease.inOutQuad(t / 0.15);
        } else if (t > 0.9) {
          const tail = ease.clamp((1 - t) / 0.1);
          m.opacity = tail * tail;
        } else {
          m.opacity = 1;
        }

        if (flare) {
          const fm = flare.material as THREE.SpriteMaterial;
          fm.opacity = THREE.MathUtils.damp(fm.opacity, 0, 5, 0.016);
        }
      }
    },
    [cycleMs],
  );

  const updateParticles = useCallback((dt: number, on: boolean) => {
    const particles = particlesRef.current;
    const speeds = particleSpeedsRef.current;
    if (!particles || !speeds) return;

    const positions = particles.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;
    const count = arr.length / 3;

    if (on) {
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        const speed = speeds[i];

        // Радиальное движение от центра
        const len = Math.sqrt(arr[k] ** 2 + arr[k + 1] ** 2 + arr[k + 2] ** 2);
        if (len > 0) {
          arr[k] += (arr[k] / len) * speed * dt;
          arr[k + 1] += (arr[k + 1] / len) * speed * dt;
          arr[k + 2] += (arr[k + 2] / len) * speed * dt;
        }

        // Сброс улетевших частиц
        const dist = Math.sqrt(arr[k] ** 2 + arr[k + 1] ** 2 + arr[k + 2] ** 2);
        if (dist > 3.5) {
          resetParticle(i, arr, speeds);
        }
      }

      const mat = particles.material as THREE.PointsMaterial;
      mat.opacity = THREE.MathUtils.clamp(mat.opacity + dt * 1.5, 0, 0.8);
      particles.visible = true;
      positions.needsUpdate = true;
    } else {
      const mat = particles.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, mat.opacity - dt * 1.2);
      if (mat.opacity <= 0.02) particles.visible = false;
    }
  }, []);
  // Эффект инициализации и рендера сцены
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearAlpha(0);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Освещение
    const ambient = new THREE.AmbientLight(0x2a2a2a, 0.8);
    scene.add(ambient);

    // Центральная огненная сфера (солнце)
    const sunGeo = new THREE.SphereGeometry(1.3, 96, 96);
    const sunTex = createFireTexture(512);
    const sunMat = new THREE.MeshStandardMaterial({
      map: sunTex,
      emissive: 0xffaa00,
      emissiveIntensity: 1.2,
      emissiveMap: sunTex,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: false,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);
    sunRef.current = sun;

    // Корона (атмосфера вокруг)
    const coronaGeo = new THREE.SphereGeometry(1.6, 96, 96);
    const coronaTex = createCoronaTexture(512);
    const coronaMat = new THREE.MeshBasicMaterial({
      map: coronaTex,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    scene.add(corona);
    coronaRef.current = corona;

    // Внутреннее свечение
    const glowTex = createGlowTexture(512);
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffdd77,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(4.2, 4.2, 1);
    scene.add(glow);
    glowRef.current = glow;

    // Вспышка (активируется при переплавке)
    const flareTex = createFlareTexture(256);
    const flareMat = new THREE.SpriteMaterial({
      map: flareTex,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const flare = new THREE.Sprite(flareMat);
    flare.scale.set(5.5, 5.5, 1);
    scene.add(flare);
    flareRef.current = flare;

    // Частицы (плазменные выбросы)
    const particleCount = 80;
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      resetParticle(i, positions, speeds);
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (!particleTextureRef.current) {
      particleTextureRef.current = createParticleTexture(128);
    }
    const particleMat = new THREE.PointsMaterial({
      map: particleTextureRef.current ?? undefined,
      color: 0xffd27a,
      size: 0.08,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      alphaTest: 0.1,
    });
    if (particleMat.map) {
      particleMat.map.anisotropy = 8;
    }
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;
    particleSpeedsRef.current = speeds;

    // Токены
    const tokenGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const gramMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const ggMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const loader = new THREE.TextureLoader();
    loader.load("./GRAM.png", (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      gramMat.map = t;
      gramMat.needsUpdate = true;
    });
    loader.load("./GG.png", (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      ggMat.map = t;
      ggMat.needsUpdate = true;
    });
    const gram = new THREE.Mesh(tokenGeo, gramMat);
    gram.position.set(0, 2.2, 0.5);
    gram.renderOrder = 10;
    scene.add(gram);
    gramRef.current = gram;

    const gg = new THREE.Mesh(tokenGeo.clone(), ggMat);
    gg.position.set(0, 0, 0.5);
    gg.renderOrder = 11;
    scene.add(gg);
    ggRef.current = gg;

    // Resize с адаптивным масштабированием
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // Адаптивное масштабирование сцены для мобильных
      const scale = Math.min(w / 500, h / 700, 1);
      if (sunRef.current) {
        const baseScale = 0.85 + scale * 0.15;
        sunRef.current.scale.setScalar(baseScale);
      }
      if (coronaRef.current) {
        const baseScale = 0.85 + scale * 0.15;
        coronaRef.current.scale.setScalar(baseScale);
      }

      // Адаптивный размер частиц
      if (particlesRef.current) {
        const mat: THREE.PointsMaterial = particlesRef.current.material as THREE.PointsMaterial;
        mat.size = 0.08 * (0.7 + scale * 0.3);
      }
    };
    const ro = new ResizeObserver(resize);
    resize();
    ro.observe(container);

    // Animation loop
    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;

      updateSun(now, dt);
      if (activeRef.current) {
        updateCycle(now);
        updateParticles(dt, true);
      } else {
        updateIdle(dt);
        updateParticles(dt, false);
      }

      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    // Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
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
            for (const m of obj.material) {
              m.dispose();
            }
          } else {
            (obj.material as THREE.Material | undefined)?.dispose?.();
          }
        }
      });
    };
  }, [updateSun, updateCycle, updateParticles, updateIdle]);

  return <div ref={containerRef} className="maining-canvas" role="presentation" />;
}

function resetParticle(i: number, arr: Float32Array, speeds: Float32Array) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 1.5 + Math.random() * 0.25;

  const k = i * 3;
  arr[k] = r * Math.sin(phi) * Math.cos(theta);
  arr[k + 1] = r * Math.sin(phi) * Math.sin(theta);
  arr[k + 2] = r * Math.cos(phi);

  speeds[i] = 0.8 + Math.random() * 1.2;
}

// Процедурная текстура огня с мягкими переходами и детализацией
function createFireTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Возвращаем пустую текстуру, если 2D контекст недоступен
    return new THREE.CanvasTexture(canvas);
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  baseGrad.addColorStop(0.0, "#fffaf2");
  baseGrad.addColorStop(0.2, "#ffe0b4");
  baseGrad.addColorStop(0.4, "#ffc074");
  baseGrad.addColorStop(0.6, "#ff944e");
  baseGrad.addColorStop(0.78, "#ff6233");
  baseGrad.addColorStop(0.9, "#d43a24");
  baseGrad.addColorStop(1.0, "#2b0c0a");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size - 0.5;
      const ny = y / size - 0.5;
      const r = Math.sqrt(nx * nx + ny * ny);
      if (r > 0.5) continue;
      const angle = Math.atan2(ny, nx);
      const swirl = Math.sin(angle * 4 + r * 14);
      const bands = Math.sin((nx + ny) * 24) * 0.5 + Math.cos((nx - ny) * 28) * 0.5;
      const falloff = Math.max(0, 1 - r * 2) ** 2.2;
      const delta = (swirl * 0.35 + bands * 0.25) * 48 * falloff;
      const idx = (y * size + x) * 4;
      data[idx] = clamp255(data[idx] + delta);
      data[idx + 1] = clamp255(data[idx + 1] + delta * 0.8);
      data[idx + 2] = clamp255(data[idx + 2] + delta * 0.65);
    }
  }
  ctx.putImageData(img, 0, 0);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = size;
  blurCanvas.height = size;
  const blurCtx = blurCanvas.getContext("2d");
  if (blurCtx) {
    blurCtx.filter = "blur(3px)";
    blurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.filter = "blur(1.2px)";
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.filter = "none";
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.center.set(0.5, 0.5);
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  return tex;
}

// Корона (атмосфера) с мягкими границами
function createCoronaTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0.0, "rgba(255, 220, 160, 0.95)");
  grad.addColorStop(0.25, "rgba(255, 190, 120, 0.75)");
  grad.addColorStop(0.5, "rgba(255, 150, 80, 0.5)");
  grad.addColorStop(0.75, "rgba(255, 110, 50, 0.2)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = size;
  blurCanvas.height = size;
  const blurCtx = blurCanvas.getContext("2d");
  if (blurCtx) {
    blurCtx.filter = "blur(5px)";
    blurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.filter = "blur(2px)";
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.filter = "none";
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.generateMipmaps = false;
  return tex;
}

// Внутреннее свечение с мягким падением
function createGlowTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 248, 224, 1)");
  grad.addColorStop(0.25, "rgba(255, 228, 180, 0.96)");
  grad.addColorStop(0.5, "rgba(255, 198, 120, 0.82)");
  grad.addColorStop(0.7, "rgba(255, 164, 72, 0.5)");
  grad.addColorStop(0.9, "rgba(255, 120, 40, 0.18)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = size;
  blurCanvas.height = size;
  const blurCtx = blurCanvas.getContext("2d");
  if (blurCtx) {
    blurCtx.filter = "blur(8px)";
    blurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.filter = "blur(4px)";
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.filter = "none";
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.generateMipmaps = false;
  return tex;
}

// Вспышка с лёгкими краями
function createFlareTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.18, "rgba(255, 248, 214, 0.96)");
  grad.addColorStop(0.38, "rgba(255, 224, 160, 0.78)");
  grad.addColorStop(0.58, "rgba(255, 188, 104, 0.52)");
  grad.addColorStop(0.78, "rgba(255, 140, 64, 0.24)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = size;
  blurCanvas.height = size;
  const blurCtx = blurCanvas.getContext("2d");
  if (blurCtx) {
    blurCtx.filter = "blur(10px)";
    blurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.filter = "blur(5px)";
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.filter = "none";
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.generateMipmaps = false;
  return tex;
}

// Текстура для частиц (искры)
function createParticleTexture(size: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 244, 210, 1)");
  grad.addColorStop(0.4, "rgba(255, 210, 120, 0.85)");
  grad.addColorStop(0.7, "rgba(255, 150, 60, 0.4)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 2;
  tex.generateMipmaps = false;
  return tex;
}

function clamp255(v: number) {
  return Math.min(255, Math.max(0, v));
}
