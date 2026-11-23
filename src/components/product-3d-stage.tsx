"use client";

/**
 * Product 3D stage.
 *
 * A narrow client island: the product page stays a server component and only
 * mounts this when a completed GLB exists. Three.js is imported dynamically so
 * it never enters the initial bundle, and every failure path (no WebGL, load
 * error, reduced motion, unmounted) falls back to the original product photo.
 *
 * Rendering is display-only. No inference happens in the browser.
 */

import { useEffect, useRef, useState } from "react";
// Type-only imports are erased at compile time and add nothing to the bundle.
import type { Material, Mesh } from "three";

interface Product3dStageProps {
  modelUrl: string;
  posterUrl: string;
  alt: string;
}

type StageState = "loading" | "ready" | "fallback";

export function Product3dStage({ modelUrl, posterUrl, alt }: Product3dStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<StageState>("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let renderer: import("three").WebGLRenderer | undefined;

    const dispose = () => {
      disposed = true;
      cleanup?.();
      cleanup = undefined;
    };

    async function boot() {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        if (disposed || !container) return;

        const width = container.clientWidth || 640;
        const height = container.clientHeight || 640;

        const glRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer = glRenderer;
        glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        glRenderer.setSize(width, height, false);
        glRenderer.outputColorSpace = THREE.SRGBColorSpace;
        glRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        glRenderer.toneMappingExposure = 1.05;
        glRenderer.shadowMap.enabled = true;
        glRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        glRenderer.domElement.className = "product-stage-canvas";
        container.appendChild(glRenderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
        camera.position.set(0, 1.55, 5.1);

        const controls = new OrbitControls(camera, glRenderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.075;
        controls.enablePan = false;
        controls.minDistance = 2.8;
        controls.maxDistance = 8;
        controls.minPolarAngle = Math.PI * 0.12;
        controls.maxPolarAngle = Math.PI * 0.62;
        controls.target.set(0, 0.62, 0);

        // Matte black stage: low ambient fill, one white spotlight key, a cool
        // rim so edges stay readable against the dark floor.
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));

        const keyLight = new THREE.SpotLight(0xffffff, 26, 24, Math.PI / 6, 0.45, 2);
        keyLight.position.set(0.8, 6.4, 4.6);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.bias = -0.0004;
        keyLight.shadow.radius = 3;
        scene.add(keyLight);
        scene.add(keyLight.target);

        const rimLight = new THREE.DirectionalLight(0xc7d2e0, 1.1);
        rimLight.position.set(-4, 3, -5);
        scene.add(rimLight);

        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(1.72, 1.8, 0.12, 96),
          new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.72, metalness: 0.12 }),
        );
        platform.position.y = -0.06;
        platform.receiveShadow = true;
        scene.add(platform);

        // Keep the original photo visible behind the transparent canvas as a
        // soft backdrop while the model loads.
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(modelUrl);
        if (disposed) {
          // Unmounted while the GLB was downloading: the effect's cleanup may
          // have run before the canvas existed, so tear everything down here.
          platform.geometry.dispose();
          (platform.material as Material).dispose();
          gltf.scene.traverse((object) => {
            const mesh = object as Mesh;
            if (mesh.isMesh) {
              mesh.geometry?.dispose();
              const material = mesh.material;
              if (Array.isArray(material)) material.forEach((m) => m.dispose());
              else material?.dispose();
            }
          });
          glRenderer.dispose();
          glRenderer.domElement.remove();
          return;
        }

        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.15 / largest;

        model.position.set(-center.x * scale, -box.min.y * scale + 0.02, -center.z * scale);
        model.scale.setScalar(scale);
        model.traverse((child) => {
          const mesh = child as Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        const pivot = new THREE.Group();
        pivot.add(model);
        scene.add(pivot);

        const clock = new THREE.Clock();
        let frame = 0;
        let visible = true;
        // Auto-rotation yields to the visitor the moment they drag, then
        // resumes after a pause so the product never fights their input.
        let interacting = false;
        let resumeAt = 0;
        const onControlStart = () => {
          interacting = true;
        };
        const onControlEnd = () => {
          interacting = false;
          resumeAt = performance.now() + 3000;
        };
        controls.addEventListener("start", onControlStart);
        controls.addEventListener("end", onControlEnd);
        const bob = reducedMotion ? 0 : 0.045;
        let spin = 0;

        const render = () => {
          if (disposed) return;
          const t = clock.getElapsedTime();
          controls.update();
          if (!reducedMotion && !interacting && performance.now() > resumeAt) {
            spin += 0.0045;
            pivot.rotation.y = spin;
          }
          if (bob) pivot.position.y = Math.sin(t * 1.05) * bob;
          glRenderer.render(scene, camera);
          if (visible) frame = requestAnimationFrame(render);
        };

        const observer = new IntersectionObserver(
          ([entry]) => {
            const nowVisible = Boolean(entry?.isIntersecting) && !document.hidden;
            if (nowVisible && !visible) {
              visible = true;
              render();
            } else if (!nowVisible) {
              visible = false;
              cancelAnimationFrame(frame);
            }
          },
          { threshold: 0.05 },
        );
        observer.observe(container);

        const resize = () => {
          if (!container || disposed) return;
          const w = container.clientWidth || width;
          const h = container.clientHeight || height;
          if (w === 0 || h === 0) return;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          glRenderer.setSize(w, h, false);
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);

        // Stop the loop while the tab is hidden; resume when it returns.
        const onVisibility = () => {
          if (document.hidden) {
            visible = false;
            cancelAnimationFrame(frame);
          } else if (container && container.getBoundingClientRect().bottom > 0) {
            visible = true;
            render();
          }
        };
        document.addEventListener("visibilitychange", onVisibility);

        setState("ready");
        render();

        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          resizeObserver.disconnect();
          document.removeEventListener("visibilitychange", onVisibility);
          controls.removeEventListener("start", onControlStart);
          controls.removeEventListener("end", onControlEnd);
          controls.dispose();
          scene.traverse((object) => {
            const mesh = object as Mesh;
            if (mesh.isMesh) {
              mesh.geometry?.dispose();
              const material = mesh.material;
              if (Array.isArray(material)) material.forEach((m) => m.dispose());
              else material?.dispose();
            }
          });
          glRenderer.dispose();
          glRenderer.domElement.remove();
        };
      } catch {
        if (!disposed) {
          // Free the WebGL context so a failed load does not leave a renderer
          // (and its GPU buffers) alive behind the poster image.
          renderer?.dispose();
          renderer?.domElement.remove();
          renderer = undefined;
          cleanup = undefined;
          setState("fallback");
        }
      }
    }

    void boot();
    return dispose;
  }, [modelUrl]);

  return (
    <div className="product-3d" data-state={state}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="product-3d-poster" src={posterUrl} alt={alt} />
      <div ref={containerRef} className="product-3d-canvas-host" aria-hidden="true" />
      {state === "ready" ? (
        <p className="product-3d-hint">
          <span className="product-3d-badge">3D</span> Drag to rotate Â· scroll or pinch to zoom
        </p>
      ) : null}
    </div>
  );
}
