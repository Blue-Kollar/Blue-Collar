import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useNetworkMonitor } from "./NetworkMonitor";

export const OfflineBanner: React.FC = () => {
  const { isOffline, syncStatus, pendingActionsCount } = useNetworkMonitor();

  if (!isOffline && syncStatus === "idle" && pendingActionsCount === 0) return null;

  const getBannerContent = () => {
    if (isOffline) return { bg: "#FF6B6B", text: "You're offline — showing cached data", spinner: true };
    if (syncStatus === "syncing") return { bg: "#4ECDC4", text: `Syncing ${pendingActionsCount} action${pendingActionsCount !== 1 ? "s" : ""}...`, spinner: true };
    if (syncStatus === "error") return { bg: "#FF6B6B", text: `Sync failed for ${pendingActionsCount} action${pendingActionsCount !== 1 ? "s" : ""}`, spinner: false };
    if (pendingActionsCount > 0) return { bg: "#FFE66D", text: `${pendingActionsCount} action${pendingActionsCount !== 1 ? "s" : ""} queued`, spinner: false };
    return null;
  };

  const content = getBannerContent();
  if (!content) return null;

  return (
    <View style={[styles.banner, { backgroundColor: content.bg }]}>
      {content.spinner && syncStatus === "syncing" && (
        <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
      )}
      <Text style={styles.text}>{content.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  icon: { marginRight: 8 },
  text: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
});