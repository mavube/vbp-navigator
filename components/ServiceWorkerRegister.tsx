"use client";

import { useEffect } from "react";

// Registers public/sw.js so the app is installable (PWA requirement).
// Silently no-ops if the browser doesn't support service workers.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
