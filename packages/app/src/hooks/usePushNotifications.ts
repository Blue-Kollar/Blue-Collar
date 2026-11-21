"use client";

import { useEffect, useState } from "react";
import { useToast } from "./useToast";
import { readLocalStorageValue } from "./useLocalStorage";

export function usePushNotifications() {
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
      if ("permissions" in navigator) {
        navigator.permissions.query({ name: "notifications" }).then((result) => {
          setPermissionStatus(result.state as NotificationPermission);
          result.addEventListener("change", () => {
            setPermissionStatus(result.state as NotificationPermission);
          });
        });
      }
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("[usePushNotifications] error checking subscription:", error);
    }
  };

  const subscribe = async () => {
    if (!isSupported) {
      toast(
        "Not Supported",
        "error",
        { description: "Push notifications are not available in your browser" }
      );
      return;
    }

    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast(
          "Permission Denied",
          "error",
          { description: "Enable notifications in browser settings to receive updates" }
        );
        setIsLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error("VAPID public key not configured");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const response = await fetch("/api/users/me/push-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${readLocalStorageValue<string | null>("token", "") ?? ""}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            auth: arrayBufferToBase64(subscription.getKey("auth")),
            p256dh: arrayBufferToBase64(subscription.getKey("p256dh")),
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to save subscription");

      setIsSubscribed(true);
      setPermissionStatus("granted");
      toast(
        "Notifications Enabled",
        "success",
        { description: "You'll receive updates about worker availability" }
      );
    } catch (error) {
      console.error("[usePushNotifications] subscribe error:", error);
      toast(
        "Error",
        "error",
        { description: "Failed to enable notifications. Please try again." }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) throw new Error("No subscription found");

      const response = await fetch("/api/users/me/push-subscription", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${readLocalStorageValue<string | null>("token", "") ?? ""}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      if (!response.ok) throw new Error("Failed to remove subscription");

      await subscription.unsubscribe();
      setIsSubscribed(false);
      toast(
        "Notifications Disabled",
        "success",
        { description: "You will no longer receive notifications" }
      );
    } catch (error) {
      console.error("[usePushNotifications] unsubscribe error:", error);
      toast(
        "Error",
        "error",
        { description: "Failed to disable notifications" }
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permissionStatus,
    subscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window.btoa(binary);
}
