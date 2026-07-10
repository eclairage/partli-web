"use client";

import { useEffect, useRef } from "react";
import type { RoomData } from "@/lib/supabase";
import type { Box3D } from "@/lib/roomplan3d";

const COLORS: Record<Box3D["kind"], number> = {
  wall: 0x1e293b,
  door: 0xf97316,
  window: 0x007889,
  opening: 0xcbd5e1,
  object: 0x8fd1da,
};

export default function Room3DViewer({ room }: { room: RoomData }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let frameId: number;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [THREE, { OrbitControls }, { buildRoom3D }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        import("@/lib/roomplan3d"),
      ]);
      if (disposed) return;

      const scene3d = buildRoom3D(room);
      const { bounds } = scene3d;
      const centerX = (bounds.min_x + bounds.max_x) / 2;
      const centerZ = (bounds.min_z + bounds.max_z) / 2;
      const span = Math.max(bounds.max_x - bounds.min_x, bounds.max_z - bounds.min_z, 6);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf8fafc);

      const camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        200
      );
      camera.position.set(centerX + span * 0.7, span * 0.9, centerZ + span * 0.7);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(centerX, bounds.max_y / 2, centerZ);
      controls.update();

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
      dirLight.position.set(centerX + span, span * 2, centerZ + span);
      scene.add(dirLight);

      const grid = new THREE.GridHelper(span * 2, Math.round(span * 2));
      grid.position.set(centerX, 0, centerZ);
      scene.add(grid);

      for (const box of scene3d.boxes) {
        const geometry = new THREE.BoxGeometry(box.width, box.height, box.depth);
        // Walls are translucent so the room's interior (doors, windows, objects)
        // stays visible from any orbit angle — this is a review aid, not a solid model.
        const material = new THREE.MeshStandardMaterial({
          color: COLORS[box.kind],
          transparent: true,
          opacity: box.kind === "wall" ? 0.35 : 0.9,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(box.cx, box.cy, box.cz);
        mesh.rotation.y = -(box.rotationDeg * Math.PI) / 180;
        scene.add(mesh);
      }

      function handleResize() {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      }
      window.addEventListener("resize", handleResize);

      function animate() {
        frameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();

      cleanup = () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(frameId);
        controls.dispose();
        renderer.dispose();
        container.removeChild(renderer.domElement);
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [room]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded border border-slate-100 bg-slate-50"
      style={{ height: 420 }}
    />
  );
}
