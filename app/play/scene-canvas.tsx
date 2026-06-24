"use client";
// three.js 반응형 씬(S4): 상태를 그리고 마우스 픽/호버만 위로 올린다(로직은 controller).
// 지형은 맵 변경 시 재구성, 유닛엔 HP 바, 호버로 커서 이동. next/dynamic({ssr:false})로만 로드.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Coord, GameMap, GameState } from "@/lib/game/srpg/types";
import { statOf } from "@/lib/game/srpg/types";
import { HL, HP_BAR_BG, hpBarColor, tileVisual, worldPos } from "./board";
import { unitTexture } from "./sprites";

type Props = {
  state: GameState;
  selectedId: string | null;
  moveTiles: Coord[];
  attackTiles: Coord[];
  cursor: Coord;
  onPick: (coord: Coord) => void;
  onHover: (coord: Coord) => void;
};

// 보드 바운딩에 맞춰 카메라 거리·위치 산출(완화된 3/4, 어떤 화면비에서도 안 잘리게).
function frameBoard(
  camera: THREE.PerspectiveCamera,
  map: GameMap,
  aspect: number,
) {
  const fov = 35;
  const pitch = (55 * Math.PI) / 180;
  camera.fov = fov;
  camera.aspect = aspect;
  const r = 0.5 * Math.hypot(map.cols, map.rows) + 1.2;
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
  onHover,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const onHoverRef = useRef(onHover);
  const mapRef = useRef<GameMap>(state.map);
  useEffect(() => {
    onPickRef.current = onPick;
    onHoverRef.current = onHover;
  });

  const rt = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    tilesGroup: THREE.Group;
    units: THREE.Group;
    hl: THREE.Group;
    tiles: THREE.Mesh[];
    tileGeo: THREE.BoxGeometry;
    planeGeo: THREE.PlaneGeometry;
    barGeo: THREE.PlaneGeometry;
    dynMats: THREE.Material[];
    staticMats: THREE.Material[];
    render: () => void;
    resize: () => void;
  } | null>(null);

  // 1회 셋업(지형 제외): 렌더러·씬·카메라·그룹·raycast·포인터·리사이즈.
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

    const tilesGroup = new THREE.Group();
    const units = new THREE.Group();
    const hl = new THREE.Group();
    scene.add(tilesGroup, units, hl);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight || Math.round(w * 0.62);
      renderer.setSize(w, h); // updateStyle=true → 캔버스 CSS를 컨테이너에 맞춰 잘림 방지
      frameBoard(camera, mapRef.current, w / h);
      render();
    };

    rt.current = {
      renderer,
      scene,
      camera,
      tilesGroup,
      units,
      hl,
      tiles: [],
      tileGeo: new THREE.BoxGeometry(0.96, 1, 0.96),
      planeGeo: new THREE.PlaneGeometry(0.9, 0.9),
      barGeo: new THREE.PlaneGeometry(1, 1),
      dynMats: [],
      staticMats: [],
      render,
      resize,
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // raycast 픽(클릭) / 호버(좌표 변경 시에만).
    const raycaster = new THREE.Raycaster();
    const v = new THREE.Vector2();
    let lastHover = "";
    const pick = (e: PointerEvent): Coord | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      v.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      v.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(v, camera);
      const hit = raycaster.intersectObjects(rt.current?.tiles ?? [], false)[0];
      if (!hit) return null;
      const { col, row } = hit.object.userData as Coord;
      return { col, row };
    };
    const onDown = (e: PointerEvent) => {
      const c = pick(e);
      if (c) onPickRef.current(c);
    };
    const onMove = (e: PointerEvent) => {
      const c = pick(e);
      if (!c) return;
      const key = `${c.col},${c.row}`;
      if (key === lastHover) return;
      lastHover = key;
      onHoverRef.current(c);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
      const r = rt.current;
      r?.dynMats.forEach((m) => m.dispose());
      r?.staticMats.forEach((m) => m.dispose());
      r?.tileGeo.dispose();
      r?.planeGeo.dispose();
      r?.barGeo.dispose();
      renderer.dispose();
      rt.current = null;
    };
  }, []);

  // 지형: 맵이 바뀌면 재구성 + 카메라 재프레이밍.
  useEffect(() => {
    const r = rt.current;
    if (!r) return;
    r.staticMats.forEach((m) => m.dispose());
    r.staticMats = [];
    while (r.tilesGroup.children.length) {
      r.tilesGroup.remove(r.tilesGroup.children[0]);
    }
    r.tiles = [];
    const map = state.map;
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const { color, height } = tileVisual(map.tiles[row][col]);
        const mat = new THREE.MeshLambertMaterial({ color });
        r.staticMats.push(mat);
        const mesh = new THREE.Mesh(r.tileGeo, mat);
        const { x, z } = worldPos({ col, row }, map);
        mesh.scale.y = height;
        mesh.position.set(x, height / 2, z);
        mesh.userData = { col, row };
        r.tiles.push(mesh);
        r.tilesGroup.add(mesh);
      }
    }
    mapRef.current = map;
    r.resize(); // setSize + frameBoard(new map) + render
  }, [state.map]);

  // 동적: 유닛 스프라이트 + HP 바 + 하이라이트/커서/선택.
  useEffect(() => {
    const r = rt.current;
    if (!r) return;
    r.dynMats.forEach((m) => m.dispose());
    r.dynMats = [];
    for (const g of [r.units, r.hl]) {
      while (g.children.length) g.remove(g.children[0]);
    }
    const map = state.map;

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
      const { x, z } = worldPos(c, map);
      const h = tileVisual(map.tiles[c.row][c.col]).height;
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

    const bar = (
      x: number,
      y: number,
      z: number,
      width: number,
      color: number,
    ) => {
      const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
      r.dynMats.push(mat);
      const m = new THREE.Mesh(r.barGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(width, 0.12, 1);
      m.position.set(x, y, z);
      m.renderOrder = 10;
      r.units.add(m);
    };

    for (const u of state.units) {
      if (u.hp <= 0) continue;
      const { x, z } = worldPos({ col: u.col, row: u.row }, map);
      const h = tileVisual(map.tiles[u.row][u.col]).height;

      const mat = new THREE.SpriteMaterial({
        map: unitTexture(u.faction, u.cls),
        transparent: true,
      });
      r.dynMats.push(mat);
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, h + 0.6, z);
      sprite.scale.set(0.85, 0.85, 0.85);
      r.units.add(sprite);

      // HP 바(좌측정렬 전경 + 배경)
      const ratio = Math.max(0, Math.min(1, u.hp / statOf(u).maxHp));
      const W = 0.7;
      const by = h + 1.15;
      bar(x, by, z, W, HP_BAR_BG);
      bar(
        x - W / 2 + (W * ratio) / 2,
        by + 0.01,
        z,
        W * ratio,
        hpBarColor(ratio),
      );
    }

    r.render();
  }, [state, selectedId, moveTiles, attackTiles, cursor]);

  return <div ref={mountRef} className="h-full w-full" />;
}
