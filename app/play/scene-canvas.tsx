"use client";
// three.js 반응형 씬(S3): 상태를 그리고 마우스 픽만 위로 올린다(상호작용 로직은 controller가 소유).
// next/dynamic({ssr:false})로만 로드 → three가 전역/SSR 번들에서 빠진다.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createGame } from "@/lib/game/srpg/state";
import { SKIRMISH_01 } from "@/lib/game/srpg/maps/skirmish-01";
import type { Coord, GameState } from "@/lib/game/srpg/types";
import { HL, tileVisual, worldPos } from "./board";
import { unitTexture } from "./sprites";

const STATIC_MAP = createGame(SKIRMISH_01).map; // 지형은 불변(맵 1개) — 1회 구성.

type Props = {
  state: GameState;
  selectedId: string | null;
  moveTiles: Coord[];
  attackTiles: Coord[];
  cursor: Coord;
  onPick: (coord: Coord) => void;
};

// 보드 바운딩에 맞춰 카메라 거리·위치 산출(완화된 3/4, 어떤 화면비에서도 안 잘리게).
function frameBoard(camera: THREE.PerspectiveCamera, aspect: number) {
  const fov = 35;
  const pitch = (55 * Math.PI) / 180; // 위에서 내려다보되 완화(원근 약화)
  camera.fov = fov;
  camera.aspect = aspect;
  const r = 0.5 * Math.hypot(STATIC_MAP.cols, STATIC_MAP.rows) + 1.2; // 여백
  const vFov = (fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const dist = r / Math.sin(Math.min(vFov, hFov) / 2);
  camera.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  camera.lookAt(0, 0, 0);
  camera.near = 0.1;
  camera.far = dist * 3;
  camera.updateProjectionMatrix();
}

export default function SceneCanvas({
  state,
  selectedId,
  moveTiles,
  attackTiles,
  cursor,
  onPick,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick; // 핸들러 최신화(셋업 effect는 1회라 ref로 참조)
  });

  // 영속 객체(언마운트까지 유지). 동적 그룹만 매 갱신에 재구성.
  const rt = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    units: THREE.Group;
    hl: THREE.Group;
    tiles: THREE.Mesh[];
    planeGeo: THREE.PlaneGeometry;
    dynMats: THREE.Material[];
    render: () => void;
  } | null>(null);

  // 1회 셋업: 렌더러·씬·카메라·정적 지형·raycast.
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(6, 16, 8);
    scene.add(dir);

    // 정적 지형(타일 mesh userData={col,row} — raycast 픽용)
    const tileGeo = new THREE.BoxGeometry(0.96, 1, 0.96);
    const tiles: THREE.Mesh[] = [];
    const staticMats: THREE.Material[] = [];
    for (let row = 0; row < STATIC_MAP.rows; row++) {
      for (let col = 0; col < STATIC_MAP.cols; col++) {
        const { color, height } = tileVisual(STATIC_MAP.tiles[row][col]);
        const mat = new THREE.MeshLambertMaterial({ color });
        staticMats.push(mat);
        const mesh = new THREE.Mesh(tileGeo, mat);
        const { x, z } = worldPos({ col, row }, STATIC_MAP);
        mesh.scale.y = height;
        mesh.position.set(x, height / 2, z);
        mesh.userData = { col, row };
        tiles.push(mesh);
        scene.add(mesh);
      }
    }

    const units = new THREE.Group();
    const hl = new THREE.Group();
    scene.add(units, hl);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const render = () => renderer.render(scene, camera);
    const planeGeo = new THREE.PlaneGeometry(0.9, 0.9);

    rt.current = {
      renderer,
      scene,
      camera,
      units,
      hl,
      tiles,
      planeGeo,
      dynMats: [],
      render,
    };

    // 리사이즈: setSize(updateStyle=true 기본)로 캔버스 CSS를 컨테이너에 맞춰 **잘림 방지** + 재프레이밍.
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight || Math.round(w * 0.62);
      renderer.setSize(w, h);
      frameBoard(camera, w / h);
      render();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // 마우스 픽: 타일 raycast → 좌표 → onPick.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(tiles, false)[0];
      if (hit) {
        const { col, row } = hit.object.userData as Coord;
        onPickRef.current({ col, row });
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
      rt.current?.dynMats.forEach((m) => m.dispose());
      staticMats.forEach((m) => m.dispose());
      tileGeo.dispose();
      planeGeo.dispose();
      renderer.dispose();
      rt.current = null;
    };
  }, []);

  // 동적 갱신: 유닛 스프라이트 + 하이라이트/커서/선택 평면 재구성 후 렌더.
  useEffect(() => {
    const r = rt.current;
    if (!r) return;

    r.dynMats.forEach((m) => m.dispose());
    r.dynMats = [];
    for (const g of [r.units, r.hl]) {
      while (g.children.length) g.remove(g.children[0]);
    }

    const addPlane = (c: Coord, color: number, opacity: number, y: number) => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      r.dynMats.push(mat);
      const m = new THREE.Mesh(r.planeGeo, mat);
      m.rotation.x = -Math.PI / 2;
      const { x, z } = worldPos(c, state.map);
      const h = tileVisual(state.map.tiles[c.row][c.col]).height;
      m.position.set(x, h + y, z);
      r.hl.add(m);
    };

    for (const c of moveTiles) addPlane(c, HL.move, 0.35, 0.02);
    for (const c of attackTiles) addPlane(c, HL.attack, 0.4, 0.03);
    const sel = selectedId
      ? state.units.find((u) => u.id === selectedId && u.hp > 0)
      : null;
    if (sel) addPlane({ col: sel.col, row: sel.row }, HL.select, 0.55, 0.04);
    addPlane(cursor, HL.cursor, 0.3, 0.06);

    for (const u of state.units) {
      if (u.hp <= 0) continue;
      const mat = new THREE.SpriteMaterial({
        map: unitTexture(u.faction, u.cls),
        transparent: true,
      });
      r.dynMats.push(mat);
      const sprite = new THREE.Sprite(mat);
      const { x, z } = worldPos({ col: u.col, row: u.row }, state.map);
      const h = tileVisual(state.map.tiles[u.row][u.col]).height;
      sprite.position.set(x, h + 0.6, z);
      sprite.scale.set(0.85, 0.85, 0.85);
      r.units.add(sprite);
    }

    r.render();
  }, [state, selectedId, moveTiles, attackTiles, cursor]);

  return <div ref={mountRef} className="h-full w-full" />;
}
