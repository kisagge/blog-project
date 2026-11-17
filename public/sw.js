// 서비스 워커: **정적 자산만** 캐시하고 페이지·API는 네트워크로(허용 목록 방식).
// v1은 동일 출처 GET 전부(로그인·계정·회원 글 화면, SSE 스트림까지)를 캐시해, 공용 기기에서 로그아웃 후에도
// 오프라인 시 이전 사용자의 화면이 보이고 스트림 응답이 캐시에 쌓였다 → 활성화 시 옛 캐시를 모두 지운다.
const CACHE = "byplay-static-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll([OFFLINE_URL]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// 빌드 산출물(해시 파일명 → 불변): 캐시 우선.
const isBuildAsset = (path) => path.startsWith("/_next/static/");
// 아이콘·매니페스트: 바뀔 수 있어 네트워크 우선 + 오프라인 시 캐시.
const isAppShellAsset = (path) =>
  path.startsWith("/icons/") ||
  path === "/manifest.webmanifest" ||
  path === "/favicon.ico" ||
  path === "/icon.svg" ||
  path === "/apple-icon.png" ||
  path === OFFLINE_URL;

async function putIfOk(req, res) {
  if (res && res.status === 200 && res.type === "basic") {
    const c = await caches.open(CACHE);
    await c.put(req, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isBuildAsset(url.pathname)) {
    event.respondWith(
      caches
        .match(req)
        .then((hit) => hit || fetch(req).then((res) => putIfOk(req, res))),
    );
    return;
  }
  if (isAppShellAsset(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => putIfOk(req, res))
        .catch(() => caches.match(req)),
    );
    return;
  }
  // 페이지 이동: 캐시하지 않음(개인 화면 보존 금지). 네트워크 실패 시에만 오프라인 안내.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // 그 외(API·SSE·RSC·업로드 등)는 관여하지 않는다 — 브라우저 기본 처리.
});

// 웹 푸시 수신 → 알림 표시.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "BY Playground";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

// 알림 클릭 → 해당 URL로 이동(이미 열린 탭 있으면 포커스).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
