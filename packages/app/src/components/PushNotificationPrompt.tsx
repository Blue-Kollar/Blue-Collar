"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";

export default function PushNotificationPrompt() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, isLoading, subscribe } = usePushNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Show prompt only if:
    // - User is logged in
    // - Push notifications are supported
    // - User is not already subscribed
    // - User hasn't dismissed it
    // - User is a curator or admin
    if (
      user &&
      isSupported &&
      !isSubscribed &&
      !isDismissed &&
      (user.role === "curator" || user.role === "admin")
    ) {
      // Show after 2 seconds
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isSupported, isSubscribed, isDismissed]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg border shadow-lg p-4 z-40">
      <div className="flex items-start gap-3">
        <Bell size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Stay Updated</p>
          <p className="text-sm text-gray-600 mt-1">
            Get notified when your workers receive tips or reviews
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={() => {
                subscribe();
                setIsVisible(false);
              }}
              disabled={isLoading}
              size="sm"
              className="gap-2"
            >
              {isLoading ? "Enabling..." : "Enable Notifications"}
            </Button>
            <Button
              onClick={() => {
                setIsDismissed(true);
                setIsVisible(false);
              }}
              variant="outline"
              size="sm"
            >
              Later
            </Button>
          </div>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          aria-label="Dismiss"
          className="text-gray-400 hover:text-gray-600 shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
