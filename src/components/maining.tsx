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

type EnergyMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    uIntensity: { value: number };
    uPulse: { value: number };
  };
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
  const ringGroupRef = useRef<THREE.Group | null>(null);
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
    const ringGroup = ringGroupRef.current;
    if (!sun || !corona || !glow) return;

    sun.rotation.y += dt * 0.12;
    sun.rotation.x = Math.sin(now * 0.00018) * 0.12;

    const mat = sun.material as EnergyMaterial;
    if (mat?.uniforms) {
      mat.uniforms.uTime.value += dt;
      const targetIntensity = activeRef.current ? 1.0 : 0.65;
      mat.uniforms.uIntensity.value = THREE.MathUtils.damp(
        mat.uniforms.uIntensity.value,
        targetIntensity,
        3.4,
        dt,
      );
      mat.uniforms.uPulse.value = THREE.MathUtils.damp(
        mat.uniforms.uPulse.value,
        activeRef.current ? 1.2 : 0.7,
        2.8,
        dt,
      );
    }

    const glowMat = glow.material as THREE.SpriteMaterial;
    const targetGlow = activeRef.current ? 0.62 : 0.44;
    glowMat.opacity = THREE.MathUtils.damp(glowMat.opacity, targetGlow, 3.2, dt);
    const pulse = 1 + 0.05 * Math.sin(now * 0.0022) + 0.03 * Math.sin(now * 0.0014);
    glow.scale.set(3.15 * pulse, 3.15 * pulse, 1);

    const coronaMat = corona.material as THREE.MeshBasicMaterial;
    corona.rotation.y += dt * 0.06;
    corona.rotation.z += dt * 0.015;
    coronaMat.opacity = THREE.MathUtils.damp(
      coronaMat.opacity,
      activeRef.current ? 0.55 : 0.35,
      3.1,
      dt,
    );

    if (ringGroup) {
      ringGroup.rotation.y += dt * 0.22;
      ringGroup.rotation.x = Math.sin(now * 0.0006) * 0.08;
      const target = activeRef.current ? 0.32 : 0.18;
      for (const child of ringGroup.children) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.damp(mat.opacity, target, 2.6, dt);
      }
    }
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
        if (dist > 3.1) {
          resetParticle(i, arr, speeds);
        }
      }

      const mat = particles.material as THREE.PointsMaterial;
      mat.opacity = THREE.MathUtils.clamp(mat.opacity + dt * 1.2, 0, 0.55);
      particles.visible = true;
      positions.needsUpdate = true;
    } else {
      const mat = particles.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, mat.opacity - dt * 1.05);
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
    renderer.toneMappingExposure = 0.95;
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

    // Центральное энергетическое ядро
    const sunGeo = new THREE.SphereGeometry(1.22, 160, 160);
    const sunMat = createEnergyMaterial();
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.renderOrder = 3;
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

    // Обводящие кольца
    const ringGroup = new THREE.Group();
    ringGroupRef.current = ringGroup;
    scene.add(ringGroup);

    const ringTex = createRingTexture(512);
    const ringMaterial = new THREE.MeshBasicMaterial({
      map: ringTex,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const outerRing = new THREE.Mesh(new THREE.RingGeometry(1.55, 2.05, 128), ringMaterial.clone());
    outerRing.rotation.x = Math.PI / 2.35;
    outerRing.rotation.y = Math.PI / 12;
    ringGroup.add(outerRing);

    const innerRing = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.85, 128), ringMaterial.clone());
    innerRing.rotation.x = Math.PI / 2.05;
    innerRing.rotation.y = -Math.PI / 18;
    ringGroup.add(innerRing);

    const ribbon = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.02, 16, 220),
      ringMaterial.clone(),
    );
    ribbon.rotation.x = Math.PI / 2.6;
    ringGroup.add(ribbon);

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
      color: 0xfff0cc,
      size: 0.07,
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
  const r = 1.32 + Math.random() * 0.32;

  const k = i * 3;
  arr[k] = r * Math.sin(phi) * Math.cos(theta);
  arr[k + 1] = r * Math.sin(phi) * Math.sin(theta);
  arr[k + 2] = r * Math.cos(phi);

  speeds[i] = 0.6 + Math.random() * 0.9;
}

function createEnergyMaterial(): EnergyMaterial {
  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0.82 },
    uPulse: { value: 1 },
  } satisfies EnergyMaterial["uniforms"];

  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewDir;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = viewMatrix * worldPosition;
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = /* glsl */ `
    precision highp float;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewDir;

    uniform float uTime;
    uniform float uIntensity;
    uniform float uPulse;

    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0);
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 =   v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      i = mod(i, 289.0);
      vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );

      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );

      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }

    float fbm(vec3 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amplitude * snoise(p);
        p = p * 2.13 + 1.37;
        amplitude *= 0.45;
      }
      return value;
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewDir);
      float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);

      float t = uTime * 0.45;
      float baseNoise = fbm(normal * 2.2 + t);
      float flowNoise = fbm(vWorldPosition * 0.9 - t * 0.6);
      float pulse = sin(t * 1.4) * 0.5 + 0.5;
      float energy = clamp(0.55 * baseNoise + 0.45 * flowNoise + pulse * 0.12, 0.0, 1.0);
      energy = pow(energy, 1.25);

      vec3 deepColor = vec3(0.08, 0.1, 0.17);
      vec3 midColor = vec3(0.32, 0.26, 0.22);
      vec3 lightColor = vec3(0.98, 0.78, 0.48);
      vec3 rimColor = vec3(0.98, 0.92, 0.74);

      vec3 color = mix(deepColor, midColor, energy);
      color = mix(color, lightColor, smoothstep(0.35, 1.0, energy));
      color += rimColor * (fresnel * (0.3 + uIntensity * 0.38));
      color = mix(color, rimColor, fresnel * 0.25);
      color *= (0.82 + uIntensity * 0.28);
      color += rimColor * (uPulse - 0.9) * 0.12;

      float alpha = 0.72 + fresnel * 0.12;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  }) as EnergyMaterial;

  return material;
}

function createRingTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const cx = size / 2;
  const cy = size / 2;
  const inner = size * 0.36;
  const outer = size * 0.5;
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0.0, "rgba(255, 242, 214, 0)");
  grad.addColorStop(0.2, "rgba(255, 242, 214, 0.14)");
  grad.addColorStop(0.5, "rgba(255, 220, 180, 0.32)");
  grad.addColorStop(0.75, "rgba(245, 192, 140, 0.24)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = size;
  blurCanvas.height = size;
  const blurCtx = blurCanvas.getContext("2d");
  if (blurCtx) {
    blurCtx.filter = "blur(4px)";
    blurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.filter = "blur(1.5px)";
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
  grad.addColorStop(0.0, "rgba(255, 236, 205, 0.92)");
  grad.addColorStop(0.28, "rgba(250, 210, 162, 0.6)");
  grad.addColorStop(0.55, "rgba(242, 182, 126, 0.32)");
  grad.addColorStop(0.8, "rgba(204, 162, 150, 0.16)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = size;
  blurCanvas.height = size;
  const blurCtx = blurCanvas.getContext("2d");
  if (blurCtx) {
    blurCtx.filter = "blur(4px)";
    blurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.filter = "blur(1.8px)";
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
  grad.addColorStop(0, "rgba(255, 246, 226, 1)");
  grad.addColorStop(0.28, "rgba(255, 222, 182, 0.9)");
  grad.addColorStop(0.55, "rgba(252, 194, 136, 0.64)");
  grad.addColorStop(0.78, "rgba(224, 166, 128, 0.32)");
  grad.addColorStop(0.92, "rgba(170, 140, 134, 0.12)");
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
  grad.addColorStop(0.22, "rgba(255, 240, 210, 0.94)");
  grad.addColorStop(0.45, "rgba(255, 214, 170, 0.7)");
  grad.addColorStop(0.68, "rgba(226, 178, 146, 0.34)");
  grad.addColorStop(0.85, "rgba(170, 140, 138, 0.16)");
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
  grad.addColorStop(0, "rgba(255, 246, 224, 1)");
  grad.addColorStop(0.45, "rgba(255, 218, 176, 0.82)");
  grad.addColorStop(0.75, "rgba(232, 184, 142, 0.36)");
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
