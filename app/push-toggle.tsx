"use client";
import { useEffect, useState } from "react";
import { subscribePush, unsubscribePush } from "@/app/actions/push";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// 회원용 푸시 알림 켜기/끄기. vapidKey 없거나 미지원 브라우저면 숨김.
export default function PushToggle({ vapidKey }: { vapidKey?: string }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator && "PushManager" in window && !!vapidKey;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, [vapidKey]);

  if (!supported) return null;

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!),
      });
      const j = sub.toJSON();
      if (j.endpoint && j.keys?.p256dh && j.keys?.auth) {
        await subscribePush({
          endpoint: j.endpoint,
          keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
        });
        setSubscribed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      aria-pressed={subscribed}
      className="w-full rounded px-3 py-2 text-left text-zinc-600 hover:bg-black/[.04] disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/[.06]"
    >
      <span aria-hidden>{subscribed ? "🔔" : "🔕"}</span>{" "}
      {subscribed ? "알림 끄기" : "알림 받기"}
    </button>
  );
}
