import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const STORAGE_KEY = "tomoko-duc-birthday-2026-07-02-seen";
const CLOSE_ANIMATION_MS = 160;

interface ImportMetaEnv {
  VITE_BIRTHDAY_OVERRIDE?: string;
}

function isJuly2JST(): boolean {
  const env = (import.meta as unknown as { env: ImportMetaEnv }).env;
  if (env.VITE_BIRTHDAY_OVERRIDE === "true") return true;

  const now = new Date();
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return jst.getMonth() === 6 && jst.getDate() === 2;
}

// ── Flame sprite texture (teardrop shape with glow) ──────────────────

function createFlameSprite(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Flame wisp shape using bezier curves
  const cx = size / 2;
  const baseY = size * 0.85;
  const tipY = size * 0.05;

  // Outer glow (large, soft)
  const glowGrad = ctx.createRadialGradient(cx, baseY, size * 0.05, cx, size * 0.35, size * 0.55);
  glowGrad.addColorStop(0, "rgba(255,240,180,0.9)");
  glowGrad.addColorStop(0.3, "rgba(255,160,30,0.5)");
  glowGrad.addColorStop(0.6, "rgba(240,80,10,0.15)");
  glowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // Flame wisp core
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.12, baseY);
  ctx.bezierCurveTo(
    cx - size * 0.18, baseY - size * 0.25,
    cx - size * 0.08, tipY + size * 0.25,
    cx, tipY,
  );
  ctx.bezierCurveTo(
    cx + size * 0.08, tipY + size * 0.25,
    cx + size * 0.18, baseY - size * 0.25,
    cx + size * 0.12, baseY,
  );
  ctx.closePath();

  const coreGrad = ctx.createLinearGradient(cx, tipY, cx, baseY);
  coreGrad.addColorStop(0, "rgba(255,255,240,1)");
  coreGrad.addColorStop(0.15, "rgba(255,250,200,1)");
  coreGrad.addColorStop(0.4, "rgba(255,180,40,0.9)");
  coreGrad.addColorStop(0.7, "rgba(255,100,15,0.5)");
  coreGrad.addColorStop(1, "rgba(180,30,0,0)");
  ctx.fillStyle = coreGrad;
  ctx.fill();

  // Inner bright core
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.04, baseY * 0.7);
  ctx.bezierCurveTo(
    cx - size * 0.06, baseY * 0.45,
    cx - size * 0.02, tipY + size * 0.2,
    cx, tipY + size * 0.06,
  );
  ctx.bezierCurveTo(
    cx + size * 0.02, tipY + size * 0.2,
    cx + size * 0.06, baseY * 0.45,
    cx + size * 0.04, baseY * 0.7,
  );
  ctx.closePath();

  const innerGrad = ctx.createLinearGradient(cx, tipY, cx, baseY * 0.7);
  innerGrad.addColorStop(0, "rgba(255,255,255,1)");
  innerGrad.addColorStop(0.3, "rgba(255,255,220,0.9)");
  innerGrad.addColorStop(1, "rgba(255,200,60,0)");
  ctx.fillStyle = innerGrad;
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ── Three.js blazing fire ───────────────────────────────────────────

const FLAME_COUNT = 2000;
const SPARK_COUNT = 300;

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  baseX: number;
  swayFreq: number;
  swayAmp: number;
  spawnY: number;
  size: number;
}

function spawnFlame(): Particle {
  const column = Math.random();
  let cx: number, spread: number;
  if (column < 0.35) { cx = -2.5; spread = 1.6; }
  else if (column < 0.65) { cx = 0; spread = 2.0; }
  else { cx = 2.5; spread = 1.6; }

  const x = cx + (Math.random() - 0.5) * spread;
  const y = -5.5 + Math.random() * 0.3;
  return {
    pos: new THREE.Vector3(x, y, (Math.random() - 0.5) * 1.8),
    vel: new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      3.0 + Math.random() * 5.5,
      (Math.random() - 0.5) * 0.3,
    ),
    life: 0,
    maxLife: 0.7 + Math.random() * 2.0,
    baseX: x,
    swayFreq: 1.5 + Math.random() * 5,
    swayAmp: 0.08 + Math.random() * 0.5,
    spawnY: y,
    size: 0.25 + Math.random() * 0.55,
  };
}

function spawnSpark(): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 1.0 + Math.random() * 4;
  return {
    pos: new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      -2 + Math.random() * 5.5,
      (Math.random() - 0.5) * 2.5,
    ),
    vel: new THREE.Vector3(
      Math.cos(angle) * speed,
      1.5 + Math.random() * 4,
      Math.sin(angle) * speed * 0.5,
    ),
    life: 0,
    maxLife: 0.5 + Math.random() * 1.6,
    baseX: 0,
    swayFreq: 0,
    swayAmp: 0,
    spawnY: 0,
    size: 0.08 + Math.random() * 0.2,
  };
}

function useFireScene(containerRef: React.RefObject<HTMLDivElement | null>, active: boolean) {
  const frameRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 50);
    camera.position.set(0, 1.8, 9);
    camera.lookAt(0, 1.0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const flameTex = createFlameSprite();

    // ── Main flame layer (flame-shaped sprites) ──
    const flameGeo = new THREE.BufferGeometry();
    const flamePos = new Float32Array(FLAME_COUNT * 3);
    const flameCol = new Float32Array(FLAME_COUNT * 3);
    const flameSize = new Float32Array(FLAME_COUNT);

    const flames: Particle[] = [];
    for (let i = 0; i < FLAME_COUNT; i++) {
      const p = spawnFlame();
      p.life = Math.random() * p.maxLife;
      flames.push(p);
    }

    flameGeo.setAttribute("position", new THREE.BufferAttribute(flamePos, 3));
    flameGeo.setAttribute("color", new THREE.BufferAttribute(flameCol, 3));
    flameGeo.setAttribute("size", new THREE.BufferAttribute(flameSize, 1));

    const flameMat = new THREE.PointsMaterial({
      size: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      map: flameTex,
    });
    scene.add(new THREE.Points(flameGeo, flameMat));

    // ── Spark layer ──
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(SPARK_COUNT * 3);
    const sparkCol = new Float32Array(SPARK_COUNT * 3);
    const sparkSize = new Float32Array(SPARK_COUNT);

    const sparks: Particle[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const p = spawnSpark();
      p.life = Math.random() * p.maxLife;
      sparks.push(p);
    }

    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
    sparkGeo.setAttribute("size", new THREE.BufferAttribute(sparkSize, 1));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: flameTex,
    });
    scene.add(new THREE.Points(sparkGeo, sparkMat));

    // ── Base glow (bottom fire bed) ──
    const baseGeo = new THREE.PlaneGeometry(12, 2.5);
    const baseMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          float dist = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float height = vUv.y;
          float flicker = 0.85 + 0.15 * sin(vUv.x * 20.0 + uTime * 5.0) * sin(vUv.x * 17.0 + uTime * 4.3);
          float alpha = smoothstep(0.0, 0.15, height) * (1.0 - smoothstep(0.6, 1.0, height));
          alpha *= dist * flicker;
          alpha *= 0.6;
          vec3 color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.85, 0.1), dist);
          color = mix(color, vec3(0.9, 0.2, 0.0), height);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const basePlane = new THREE.Mesh(baseGeo, baseMat);
    basePlane.position.set(0, -3.8, 0);
    scene.add(basePlane);

    const tempColor = new THREE.Color();
    const clock = new THREE.Clock();

    // ── Animation ──
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;

      baseMat.uniforms.uTime.value = elapsed;

      // Flames
      for (let i = 0; i < FLAME_COUNT; i++) {
        const p = flames[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          const f = spawnFlame();
          p.pos.copy(f.pos);
          p.vel.copy(f.vel);
          p.life = 0;
          p.maxLife = f.maxLife;
          p.baseX = f.baseX;
          p.swayFreq = f.swayFreq;
          p.swayAmp = f.swayAmp;
          p.spawnY = f.spawnY;
          p.size = f.size;
        }

        const sway = Math.sin(elapsed * p.swayFreq + p.spawnY * 3.5) * p.swayAmp;
        const wind = Math.sin(elapsed * 0.7 + p.spawnY * 0.5) * 0.15;
        p.vel.x += (p.baseX + sway + wind - p.pos.x) * dt * 1.8;
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += p.vel.z * dt;

        const t = p.life / p.maxLife;
        if (t < 0.1) tempColor.setHSL(0.15, 1, 0.75);
        else if (t < 0.35) tempColor.setHSL(0.1, 1, 0.55);
        else if (t < 0.65) tempColor.setHSL(0.06, 1, 0.35);
        else tempColor.setHSL(0.04, 0.9, 0.22);

        const i3 = i * 3;
        flamePos[i3] = p.pos.x;
        flamePos[i3 + 1] = p.pos.y;
        flamePos[i3 + 2] = p.pos.z;
        flameCol[i3] = tempColor.r;
        flameCol[i3 + 1] = tempColor.g;
        flameCol[i3 + 2] = tempColor.b;
        flameSize[i] = p.size * (0.4 + 0.6 * Math.sin(t * Math.PI));
      }
      flameGeo.attributes.position.needsUpdate = true;
      flameGeo.attributes.color.needsUpdate = true;
      flameGeo.attributes.size.needsUpdate = true;

      // Sparks
      for (let i = 0; i < SPARK_COUNT; i++) {
        const p = sparks[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          const f = spawnSpark();
          p.pos.copy(f.pos);
          p.vel.copy(f.vel);
          p.life = 0;
          p.maxLife = f.maxLife;
          p.size = f.size;
        }
        p.vel.y += dt * 0.25;
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += p.vel.z * dt;

        const t = p.life / p.maxLife;
        tempColor.setHSL(0.13 - t * 0.06, 1, 0.7 - t * 0.4);

        const i3 = i * 3;
        sparkPos[i3] = p.pos.x;
        sparkPos[i3 + 1] = p.pos.y;
        sparkPos[i3 + 2] = p.pos.z;
        sparkCol[i3] = tempColor.r;
        sparkCol[i3 + 1] = tempColor.g;
        sparkCol[i3 + 2] = tempColor.b;
        sparkSize[i] = p.size * (0.3 + 0.7 * (1 - t));
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
      sparkGeo.attributes.size.needsUpdate = true;

      camera.position.x = Math.sin(elapsed * 0.2) * 0.4;
      camera.position.y = 1.8 + Math.sin(elapsed * 0.25) * 0.25;
      camera.lookAt(0, 1.0, 0);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      flameGeo.dispose();
      flameMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      baseGeo.dispose();
      baseMat.dispose();
    };
  }, [active, containerRef]);
}

// ── Dust pre-compute ────────────────────────────────────────────────

function makeDustValues(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    width: 2 + (i * 7) % 4,
    height: 2 + (i * 11) % 4,
    left: 5 + (i * 13) % 88,
    top: 10 + (i * 17) % 80,
    delay: (i * 0.4) % 4,
    duration: 2.5 + (i * 3) % 3.5,
  }));
}

// ── Component ────────────────────────────────────────────────────────

export function BirthdayCelebrationModal({
  forceShow = false,
  onClose,
}: {
  forceShow?: boolean;
  onClose?: () => void;
}) {
  const [show, setShow] = useState(() => {
    if (forceShow) return true;
    if (!isJuly2JST()) return false;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return false;
    } catch {
      // ignore
    }
    return true;
  });
  const [closing, setClosing] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dustValues = useMemo(() => makeDustValues(20), []);

  useFireScene(containerRef, show && !closing);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setShow(false);
      if (forceShow) {
        onClose?.();
      } else {
        try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
      }
    }, CLOSE_ANIMATION_MS);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-150 select-none">
      {/* Three.js fire canvas */}
      <div ref={containerRef} className="pointer-events-none absolute inset-0" />

      {/* Gradient overlay: dark top, seeing fire at bottom */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/85 via-black/45 to-transparent" />

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <p className="mb-4 text-lg italic tracking-[0.3em] text-yellow-300/90 md:text-xl">
          HAPPY BIRTHDAY
        </p>

        {/* Name with CSS sparkles */}
        <div className="relative mb-4">
          {/* CSS sparkle dots */}
          <span className="pointer-events-none absolute -left-4 -top-3 h-3 w-3 animate-text-sparkle rounded-sm bg-yellow-300 md:h-4 md:w-4" style={{ animationDelay: "0s", boxShadow: "0 0 8px 2px rgba(253,224,138,0.8)" }} />
          <span className="pointer-events-none absolute -right-3 -top-1 h-2 w-2 animate-text-sparkle rounded-sm bg-yellow-200 md:h-3 md:w-3" style={{ animationDelay: "0.6s", boxShadow: "0 0 6px 2px rgba(253,224,138,0.7)" }} />
          <span className="pointer-events-none absolute -bottom-1 -left-2 h-2 w-2 animate-text-sparkle rounded-sm bg-yellow-200 md:h-3 md:w-3" style={{ animationDelay: "1.2s", boxShadow: "0 0 6px 2px rgba(253,224,138,0.7)" }} />
          <span className="pointer-events-none absolute -right-5 bottom-1 h-3 w-3 animate-text-sparkle rounded-sm bg-yellow-300 md:h-4 md:w-4" style={{ animationDelay: "0.3s", boxShadow: "0 0 8px 2px rgba(253,224,138,0.8)" }} />
          <span className="pointer-events-none absolute left-1/2 -top-6 h-2 w-2 animate-text-sparkle rounded-sm bg-yellow-200 md:h-3 md:w-3" style={{ animationDelay: "0.9s", boxShadow: "0 0 6px 2px rgba(253,224,138,0.7)" }} />

          <h1
            className={
              "relative text-center text-5xl font-bold tracking-[0.12em] md:text-7xl lg:text-8xl" +
              (closing ? " animate-birthday-out" : " animate-birthday-in")
            }
            style={{
              fontFamily: "'Shippori Mincho B1', serif",
              background: "linear-gradient(120deg, #fff 0%, #fde68a 25%, #fff 50%, #fbbf24 75%, #fff 100%)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: `drop-shadow(0 0 30px rgba(251,191,36,0.7)) drop-shadow(0 0 60px rgba(251,146,30,0.5)) drop-shadow(0 0 100px rgba(239,68,68,0.4)) drop-shadow(0 4px 8px rgba(0,0,0,0.5))`,
              animation: "text-shine 3s ease-in-out infinite",
            }}
          >
            金澤朋子さん
          </h1>
        </div>

        <p
          className="text-xl font-bold tracking-[0.15em] md:text-2xl lg:text-3xl"
          style={{
            fontFamily: "'Shippori Mincho B1', serif",
            background: "linear-gradient(120deg, #fff 0%, #fde68a 30%, #fff 50%, #fbbf24 70%, #fff 100%)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 15px rgba(251,191,36,0.5)) drop-shadow(0 0 30px rgba(251,146,30,0.3)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            animation: "text-shine 3.5s ease-in-out 0.5s infinite",
          }}
        >
          お誕生日おめでとうございます！
        </p>

        <button
          type="button"
          onClick={handleClose}
          className="mt-14 rounded-full border border-white/30 bg-white/5 px-8 py-2.5 text-xs font-bold tracking-[0.2em] text-white/80 backdrop-blur transition hover:bg-white/15 hover:text-white active:scale-95"
          style={{ fontFamily: "'Shippori Mincho B1', serif" }}
        >
          閉じる
        </button>
      </div>

      {/* Floating gold dust */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {dustValues.map((d, i) => (
          <span
            key={i}
            className="absolute animate-dust-float rounded-full bg-yellow-300/70"
            style={{
              width: `${d.width}px`,
              height: `${d.height}px`,
              left: `${d.left}%`,
              top: `${d.top}%`,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
