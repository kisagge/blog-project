// @vitest-environment node
// public/sw.js를 node:vm에서 실행해 캐시 정책을 검증(브라우저 없이 라우팅·캐시 판단만).
import { beforeEach, describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import vm from "vm";

const SRC = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
const ORIGIN = "https://by-jang-blog.xyz";

type Handler = (e: unknown) => void;
let handlers: Record<string, Handler>;
let stores: Map<string, Map<string, Response>>;
let online: boolean;
let fetched: string[];

function makeCaches() {
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      put: async (req: Request | string, res: Response) => {
        m.set(
          typeof req === "string" ? new URL(req, ORIGIN).href : req.url,
          res,
        );
      },
      match: async (req: Request | string) =>
        m
          .get(typeof req === "string" ? new URL(req, ORIGIN).href : req.url)
          ?.clone(),
      addAll: async (urls: string[]) => {
        for (const u of urls)
          m.set(
            new URL(u, ORIGIN).href,
            new Response(`precached:${u}`, { status: 200 }),
          );
      },
    };
  };
  return {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (req: Request | string) => {
      const key = typeof req === "string" ? new URL(req, ORIGIN).href : req.url;
      for (const m of stores.values())
        if (m.has(key)) return m.get(key)!.clone();
      return undefined;
    },
  };
}

function load() {
  handlers = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (t: string, h: Handler) => (handlers[t] = h),
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      matchAll: async () => [],
      openWindow: async () => {},
    },
    registration: { showNotification: async () => {} },
  };
  const fetchFn = async (req: Request | string) => {
    const url = typeof req === "string" ? new URL(req, ORIGIN).href : req.url;
    fetched.push(url);
    if (!online) throw new TypeError("Failed to fetch");
    const r = new Response(`net:${url}`, { status: 200 });
    Object.defineProperty(r, "type", { value: "basic" });
    return r;
  };
  vm.runInNewContext(SRC, {
    self,
    caches: makeCaches(),
    fetch: fetchFn,
    URL,
    Response,
    Request,
    console,
  });
}

async function runLifecycle(type: "install" | "activate") {
  let p: Promise<unknown> = Promise.resolve();
  handlers[type]({ waitUntil: (x: Promise<unknown>) => (p = x) });
  await p;
}

// fetch 이벤트를 보내고, respondWith가 불렸으면 그 응답 본문을, 아니면 null(브라우저 기본 처리).
async function dispatch(
  path: string,
  init: {
    method?: string;
    mode?: RequestMode;
    headers?: Record<string, string>;
  } = {},
): Promise<string | null> {
  const url = path.startsWith("http") ? path : ORIGIN + path;
  const request = new Request(url, {
    method: init.method ?? "GET",
    headers: init.headers,
  });
  Object.defineProperty(request, "mode", { value: init.mode ?? "cors" });
  const out: { responded: Promise<Response> | null } = { responded: null };
  const waits: Promise<unknown>[] = [];
  handlers.fetch({
    request,
    respondWith: (r: Promise<Response>) => (out.responded = Promise.resolve(r)),
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  if (!out.responded) return null;
  const res = await out.responded;
  await Promise.all(waits);
  await new Promise((r) => setTimeout(r, 0)); // 비동기 캐시 저장 대기
  return res ? await res.text() : "";
}

const cachedUrls = () => [...stores.values()].flatMap((m) => [...m.keys()]);

beforeEach(async () => {
  stores = new Map();
  online = true;
  fetched = [];
  // 이전 버전(v1)이 개인 페이지까지 캐시해 둔 상태를 재현
  stores.set(
    "byplay-v1",
    new Map([[ORIGIN + "/account", new Response("이전 사용자 계정 화면")]]),
  );
  load();
  await runLifecycle("install");
  await runLifecycle("activate");
});

describe("서비스 워커 캐시 정책", () => {
  test("활성화 시 옛 캐시(v1: 개인 페이지 포함) 삭제, 오프라인 안내 페이지는 미리 저장", async () => {
    expect(stores.has("byplay-v1")).toBe(false);
    expect(cachedUrls()).toContain(ORIGIN + "/offline.html");
  });

  test("페이지 이동은 네트워크만 — 로그인·계정 화면을 캐시하지 않음", async () => {
    for (const p of ["/signin", "/account", "/feed/members-only"])
      expect(await dispatch(p, { mode: "navigate" })).toBe(`net:${ORIGIN}${p}`);
    expect(cachedUrls().filter((u) => !u.endsWith("/offline.html"))).toEqual(
      [],
    );
  });

  test("오프라인 페이지 이동 → 오프라인 안내(이전에 본 개인 화면이 아님)", async () => {
    await dispatch("/account", { mode: "navigate" });
    online = false;
    expect(await dispatch("/account", { mode: "navigate" })).toBe(
      "precached:/offline.html",
    );
  });

  test("API·SSE·RSC·업로드·POST·외부 출처는 관여하지 않음(브라우저 기본 처리)", async () => {
    expect(await dispatch("/api/events")).toBeNull();
    expect(await dispatch("/api/feed-events?feed=x")).toBeNull();
    expect(
      await dispatch("/feed/x?_rsc=abc", { headers: { RSC: "1" } }),
    ).toBeNull();
    expect(await dispatch("/uploads/a.png")).toBeNull();
    expect(await dispatch("/feed/x", { method: "POST" })).toBeNull();
    expect(await dispatch("https://cdn.example.com/a.js")).toBeNull();
    expect(cachedUrls().filter((u) => !u.endsWith("/offline.html"))).toEqual(
      [],
    );
  });

  test("빌드 정적 자산은 캐시 우선(해시 파일명이라 불변) — 오프라인에서도 제공", async () => {
    const js = "/_next/static/chunks/app-abc123.js";
    expect(await dispatch(js)).toBe(`net:${ORIGIN}${js}`);
    online = false;
    fetched = [];
    expect(await dispatch(js)).toBe(`net:${ORIGIN}${js}`);
    expect(fetched).toEqual([]); // 네트워크 안 감
  });

  test("아이콘·매니페스트는 네트워크 우선 + 오프라인 시 캐시", async () => {
    for (const p of ["/icons/icon-192.png", "/manifest.webmanifest"]) {
      expect(await dispatch(p)).toBe(`net:${ORIGIN}${p}`);
      online = false;
      expect(await dispatch(p)).toBe(`net:${ORIGIN}${p}`);
      online = true;
    }
  });
});
