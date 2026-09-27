import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useStaleWhileRevalidate } from "../../cache";
import { workersApi } from "../../lib/api";

export default function DiscoveryScreen() {
  const { data: workers, isLoading, isFromCache, isRefreshing, isError, error } =
    useStaleWhileRevalidate({
      queryKey: ["workers", "discover"],
      queryFn: async () => {
        const response = await workersApi.getAll({ limit: 20 });
        if (!response.ok) throw new Error(response.error || "Failed to fetch");
        return response.data;
      },
      cacheKey: "workers:discover",
      ttl: 24 * 60 * 60 * 1000,
      staleTime: 60 * 60 * 1000,
    });

  if (isLoading && !isFromCache) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loading}>Loading workers...</Text>
      </View>
    );
  }

  if (isError && !workers) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error: {error?.message || "Failed to load"}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover Workers</Text>
        {isFromCache && (
          <Text style={styles.cacheIndicator}>
            {isRefreshing ? "🔄 Updating..." : "📱 From cache"}
          </Text>
        )}
      </View>
      <FlatList
        data={workers || []}
        renderItem={({ item }: { item: any }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.category}>{item.category} • {item.location}</Text>
            <Text style={styles.rating}>⭐ {item.rating?.toFixed(1)} ({item.reviewCount})</Text>
          </View>
        )}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  title: { fontSize: 24, fontWeight: "bold", color: "#333" },
  cacheIndicator: { fontSize: 12, color: "#666", fontStyle: "italic" },
  list: { padding: 16 },
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  name: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 4 },
  category: { fontSize: 14, color: "#666", marginBottom: 8 },
  rating: { fontSize: 14, fontWeight: "600", color: "#333" },
  loading: { marginTop: 12, fontSize: 16, color: "#666" },
  error: { fontSize: 16, color: "#FF4444", textAlign: "center", paddingHorizontal: 32 },
});