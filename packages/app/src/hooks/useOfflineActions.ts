"use client";

import { useCallback } from "react";

import { queueOfflineAction } from "@/lib/offlineQueue";

import { useToast } from "./useToast";

export function useOfflineActions() {
  const { toast } = useToast();

  const queueContactRequest = useCallback(
    async (workerId: string, message: string) => {
      try {
        const actionId = await queueOfflineAction(
          "POST",
          `/api/workers/${workerId}/contact`,
          JSON.stringify({ message }),
          "contact"
        );

        toast({
          title: "Message Queued",
          description: "Your message will be sent when you're online",
          type: "success",
        });

        return actionId;
      } catch (error) {
        console.error("[useOfflineActions] contact request error:", error);
        toast({
          title: "Error",
          description: "Failed to queue contact request",
          type: "error",
        });
        throw error;
      }
    },
    [toast]
  );

  const queueBookmarkChange = useCallback(
    async (workerId: string, isBookmarked: boolean) => {
      try {
        const method = isBookmarked ? "POST" : "DELETE";
        const actionId = await queueOfflineAction(
          method,
          `/api/workers/${workerId}/bookmark`,
          isBookmarked ? JSON.stringify({ workerId }) : undefined,
          "bookmark"
        );

        toast({
          title: "Bookmark Queued",
          description: "Your change will be saved when you're online",
          type: "success",
        });

        return actionId;
      } catch (error) {
        console.error("[useOfflineActions] bookmark error:", error);
        toast({
          title: "Error",
          description: "Failed to queue bookmark change",
          type: "error",
        });
        throw error;
      }
    },
    [toast]
  );

  const queueProfileUpdate = useCallback(
    async (updates: Record<string, unknown>) => {
      try {
        const actionId = await queueOfflineAction(
          "PATCH",
          "/api/users/me",
          JSON.stringify(updates),
          "profile-update"
        );

        toast({
          title: "Update Queued",
          description: "Your profile changes will be saved when you're online",
          type: "success",
        });

        return actionId;
      } catch (error) {
        console.error("[useOfflineActions] profile update error:", error);
        toast({
          title: "Error",
          description: "Failed to queue profile update",
          type: "error",
        });
        throw error;
      }
    },
    [toast]
  );

  return {
    queueContactRequest,
    queueBookmarkChange,
    queueProfileUpdate,
  };
}
