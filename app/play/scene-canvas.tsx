"use client";
// three.js 정적 씬(S2): 초기 전투 상태의 맵·유닛을 2.5D로 렌더(상호작용 없음).
// next/dynamic({ssr:false})로만 로드되어 three가 전역 번들·SSR에서 빠진다.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createGame } from "@/lib/game/srpg/state";
import { SKIRMISH_01 } from "@/lib/game/srpg/maps/skirmish-01";
import { tileVisual, worldPos } from "./board";
import { unitTexture } from "./sprites";

export default function SceneCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const { map, units } = createGame(SKIRMISH_01);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 12, 12);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(6, 14, 8);
    scene.add(dir);

    // 정리 대상 모음(언마운트 시 dispose). 텍스처는 캐시 공유라 제외.
    const tileGeo = new THREE.BoxGeometry(0.95, 1, 0.95);
    const disposables: { dispose: () => void }[] = [tileGeo];

    // 지형 타일
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const { color, height } = tileVisual(map.tiles[row][col]);
        const mat = new THREE.MeshLambertMaterial({ color });
        disposables.push(mat);
        const mesh = new THREE.Mesh(tileGeo, mat);
        const { x, z } = worldPos({ col, row }, map);
        mesh.scale.y = height;
        mesh.position.set(x, height / 2, z);
        scene.add(mesh);
      }
    }

    // 유닛 스프라이트(빌보드)
    for (const u of units) {
      const mat = new THREE.SpriteMaterial({
        map: unitTexture(u.faction, u.cls),
        transparent: true,
      });
      disposables.push(mat);
      const sprite = new THREE.Sprite(mat);
      const { x, z } = worldPos({ col: u.col, row: u.row }, map);
      const h = tileVisual(map.tiles[u.row][u.col]).height;
      sprite.position.set(x, h + 0.6, z);
      sprite.scale.set(0.9, 0.9, 0.9);
      scene.add(sprite);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "전술 전투 보드 미리보기");
    el.appendChild(renderer.domElement);

    const draw = (node: HTMLDivElement) => {
      const w = node.clientWidth;
      const h = node.clientHeight || Math.round(w * 0.62);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera); // S2 정적 — 단발 렌더(애니메이션 루프 없음)
    };
    draw(el);
    const ro = new ResizeObserver(() => draw(el));
    ro.observe(el);

    return () => {
      ro.disconnect();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}
