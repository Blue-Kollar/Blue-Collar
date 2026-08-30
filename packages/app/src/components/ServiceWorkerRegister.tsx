"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
      })
      .catch((error) => console.error("[ServiceWorkerRegister] error:", error));

    return () => {
      if (registration) {
        registration.unregister().catch(() => {});
      }
    };
  }, []);

  return null;
}
