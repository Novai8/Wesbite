"use client";

import { useEffect, useRef } from "react";

/**
 * Cinematic 3D hero stage: the Fyndra shopping cart rides a flowing path
 * across the viewport while scroll progress drives the journey — the cart
 * banks into turns, the camera follows, and a cobalt-blue light trail is
 * painted behind it. Everything is rendered with plain three.js in a
 * single canvas; React only owns lifecycle and resize.
 *
 * Animation phases along scroll progress p ∈ [0, 1]:
 *   0.00–0.35  cart sweeps in from the right on a rising S-curve
 *   0.35–0.70  long traveling shot: cart crosses the frame, camera tracks
 *   0.70–1.00  cart eases to the left foreground, gentle idle bob
 */

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const CART_URL = "/models/cart.glb";

export function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      if (disposed) return;

      const prefersReduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia(REDUCED_MOTION).matches;

      // ---------- renderer / scene / camera ----------
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.set(0, 1.4, 9.5);

      // ---------- lighting: cool studio with a cobalt rim ----------
      const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x0b0c10, 1.15);
      scene.add(hemi);

      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(4, 6, 5);
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x2941e8, 2.6);
      rim.position.set(-6, 3, -4);
      scene.add(rim);

      const under = new THREE.PointLight(0x2941e8, 24, 14, 2);
      under.position.set(0, 0.15, 1.5);
      scene.add(under);

      // ---------- soft ground glow (fake contact shadow) ----------
      const glowGeo = new THREE.PlaneGeometry(9, 3.4);
      const glowMat = new THREE.MeshBasicMaterial({
        map: makeGlowTexture(THREE),
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.01;
      scene.add(glow);

      // ---------- the trail: cobalt comet ribbon behind the cart ----------
      // A triangle ribbon strung along the cart's recent path, tapering to a
      // point at the tail — reads as a bold blue streak at any DPI.
      const TRAIL_POINTS = 60;
      const trailGeometry = new THREE.BufferGeometry();
      // Ribbon: 2 vertices per path sample, indexed triangles between pairs.
      const ribbonVerts = new Float32Array(TRAIL_POINTS * 2 * 3);
      const ribbonIndex: number[] = [];
      for (let i = 0; i < TRAIL_POINTS - 1; i += 1) {
        const a = i * 2;
        ribbonIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      trailGeometry.setAttribute("position", new THREE.BufferAttribute(ribbonVerts, 3));
      trailGeometry.setIndex(ribbonIndex);
      trailGeometry.setDrawRange(0, 0);
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: 0x3d55ff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const trail = new THREE.Mesh(trailGeometry, trailMaterial);
      trail.frustumCulled = false;
      scene.add(trail);

      // Ghost cars: faint cobalt silhouettes echoing the cart along its path.
      const ghostMaterial = new THREE.MeshBasicMaterial({
        color: 0x2941e8,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      const ghosts: import("three").Group[] = [];
      for (let i = 0; i < 2; i += 1) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.55), ghostMaterial);
        body.position.y = 0.55;
        const basket = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.5), ghostMaterial);
        basket.position.y = 1.05;
        g.add(body, basket);
        g.visible = false;
        scene.add(g);
        ghosts.push(g);
      }

      // ---------- cart model ----------
      let cart: import("three").Group | null = null;
      let disposeModel: (() => void) | null = null;
      const loader = new GLTFLoader();

      try {
        const gltf = await loader.loadAsync(CART_URL);
        if (disposed) return;
        cart = gltf.scene;
        cart.traverse((obj: import("three").Object3D) => {
          const mesh = obj as import("three").Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = false;
            const mat = mesh.material as import("three").MeshStandardMaterial;
            if (mat && "envMapIntensity" in mat) mat.envMapIntensity = 0.9;
          }
        });
        scene.add(cart);
      } catch {
        // Model failed to load — the scene still shows the trail path and
        // ghosts so the hero never renders empty.
        cart = null;
      }
      disposeModel = () => {
        scene.traverse((obj) => {
          const mesh = obj as import("three").Mesh;
          if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
        });
      };

      // ---------- scroll progress ----------
      const sample = () => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        progressRef.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      };
      sample();
      window.addEventListener("scroll", sample, { passive: true });

      // ---------- path definition ----------
      // A flowing S-curve through the frame. s ∈ [0,1] → world position.
      const pathX = (s: number) => 7.2 - 14.4 * easeInOut(s);
      const pathY = (s: number) => 0.55 + 1.7 * Math.sin(Math.PI * s) + 0.55 * Math.sin(2.2 * Math.PI * s);
      const pathZ = (s: number) => -1.2 + 2.6 * Math.sin(Math.PI * s) - 1.1 * s;

      function samplePath(s: number, out: import("three").Vector3) {
        out.set(pathX(s), pathY(s), pathZ(s));
        return out;
      }

      const tmpA = new THREE.Vector3();
      const tmpB = new THREE.Vector3();
      const tmpC = new THREE.Vector3();
      const tmpD = new THREE.Vector3();
      const smoothed = { s: 0 };

      // ---------- resize ----------
      const resize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      // ---------- render loop ----------
      let raf = 0;
      let visible = true;
      const clock = new THREE.Clock();
      const trailSamples: number[] = [];
      const lastGhostPos = [new THREE.Vector3(), new THREE.Vector3()];
      const ghostInit = [false, false];

      const render = () => {
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;

        // Smooth the raw scroll progress for a cinematic lag.
        const rawS = prefersReduced ? 0.12 : progressRef.current;
        smoothed.s += (rawS - smoothed.s) * Math.min(1, dt * 3.2);
        const s = smoothed.s;

        if (cart) {
          samplePath(s, tmpA);
          // Slight lookahead for banking orientation.
          const ahead = Math.min(1, s + 0.012);
          samplePath(ahead, tmpB);
          cart.position.copy(tmpA);
          cart.position.y += Math.sin(t * 1.6) * 0.045; // idle bob
          cart.lookAt(tmpB);
          cart.rotateY(-Math.PI / 2); // model faces +X; align to travel dir
          cart.rotation.z += Math.sin(t * 0.9) * 0.02;
          cart.visible = true;
        }

        // ----- trail ribbon -----
        if (!prefersReduced) {
          trailSamples.unshift(s);
          if (trailSamples.length > TRAIL_POINTS) trailSamples.pop();

          const n = trailSamples.length;
          const camDir = tmpC.copy(camera.position).normalize();
          const side = tmpD.set(0, 1, 0);

          for (let i = 0; i < n; i += 1) {
            const ts = trailSamples[i];
            samplePath(ts, tmpA);
            // Trail drifts slightly behind/below the cart for a comet feel.
            tmpA.y -= 0.1;

            // Width tapers from 0.16 at the head to 0 at the tail.
            const w = 0.16 * (1 - i / (n - 1 || 1));

            // Side vector: perpendicular to view and trail tangent.
            const ahead = Math.min(1, ts + 0.01);
            samplePath(ahead, tmpB);
            tmpB.sub(tmpA).normalize();
            side.crossVectors(camDir, tmpB).normalize().multiplyScalar(w);

            const v = i * 6;
            ribbonVerts[v] = tmpA.x + side.x;
            ribbonVerts[v + 1] = tmpA.y + side.y;
            ribbonVerts[v + 2] = tmpA.z + side.z;
            ribbonVerts[v + 3] = tmpA.x - side.x;
            ribbonVerts[v + 4] = tmpA.y - side.y;
            ribbonVerts[v + 5] = tmpA.z - side.z;
          }

          trailGeometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
          trailGeometry.attributes.position.needsUpdate = true;
          trailGeometry.computeBoundingSphere();
          trailMaterial.opacity = 0.6 + 0.25 * Math.sin(t * 2.1);
        }

        // ----- ghost echoes -----
        for (let i = 0; i < ghosts.length; i += 1) {
          const gs = s - 0.16 * (i + 1);
          if (gs > 0.02) {
            samplePath(gs, tmpA);
            tmpA.y -= 0.1;
            if (!ghostInit[i] || lastGhostPos[i].distanceTo(tmpA) > 0.001) {
              ghosts[i].position.copy(tmpA);
              ghosts[i].lookAt(tmpB.copy(tmpA).add(new THREE.Vector3(pathX(gs + 0.01) - pathX(gs), pathY(gs + 0.01) - pathY(gs), pathZ(gs + 0.01) - pathZ(gs))));
              ghosts[i].rotateY(-Math.PI / 2);
              ghostInit[i] = true;
              lastGhostPos[i].copy(tmpA);
            }
            ghosts[i].visible = true;
            ghostMaterial.opacity = Math.max(0, 0.18 - i * 0.07);
          } else {
            ghosts[i].visible = false;
          }
        }

        // ----- camera: slow parallax drift tied to scroll -----
        const camX = (s - 0.5) * 2.4;
        const camY = 1.5 + Math.sin(s * Math.PI) * 0.9;
        camera.position.x += (camX - camera.position.x) * Math.min(1, dt * 2.5);
        camera.position.y += (camY - camera.position.y) * Math.min(1, dt * 2.5);
        camera.lookAt(0, 1.05, 0);

        glow.position.x = cart ? cart.position.x * 0.9 : 0;

        renderer.render(scene, camera);
        raf = requestAnimationFrame(render);
      };

      // Pause rendering when the hero leaves the viewport (battery/CPU).
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const nowVisible = entry.isIntersecting;
            if (nowVisible && !visible && raf === 0) {
              clock.getDelta();
              raf = requestAnimationFrame(render);
            } else if (!nowVisible && visible && raf !== 0) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
            visible = nowVisible;
          }
        },
        { threshold: 0.05 },
      );
      io.observe(canvas);

      raf = requestAnimationFrame(render);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("scroll", sample);
        window.removeEventListener("resize", resize);
        disposeModel?.();
        glowGeo.dispose();
        glowMat.dispose();
        trailGeometry.dispose();
        trailMaterial.dispose();
        ghostMaterial.dispose();
        for (const g of ghosts) {
          for (const child of g.children) {
            (child as import("three").Mesh).geometry?.dispose?.();
          }
        }
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className="hero-scene" aria-hidden="true">
      <canvas ref={canvasRef} className="hero-scene-canvas" />
    </div>
  );
}

function easeInOut(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function makeGlowTexture(THREE: typeof import("three")) {
  const size = 256;
  const cnv = document.createElement("canvas");
  cnv.width = size;
  cnv.height = size;
  const ctx = cnv.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(41, 65, 232, 0.55)");
    grad.addColorStop(0.5, "rgba(41, 65, 232, 0.18)");
    grad.addColorStop(1, "rgba(41, 65, 232, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.needsUpdate = true;
  return tex;
}

