/**
 * HomeScreen — entry point shown to authenticated users.
 *
 * Displays a personalised greeting, quick-action tiles, and a summary
 * of recent worker interactions pulled from the API.
 */
import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { workersApi, contactRequestsApi } from '../../lib/api'
import { useStaleWhileRevalidate } from '../../cache'

export interface HomeScreenProps {
  onNavigateToDiscovery?: () => void
  onNavigateToProfile?: () => void
  onNavigateToWallet?: () => void
}

export default function HomeScreen({
  onNavigateToDiscovery,
  onNavigateToProfile,
  onNavigateToWallet,
}: HomeScreenProps) {
  const { user } = useAuth()

  const {
    data: recentWorkers,
    isLoading: loadingWorkers,
    isError: workersError,
  } = useStaleWhileRevalidate({
    queryKey: ['workers', 'recent'],
    queryFn: async () => {
      const res = await workersApi.getAll({ limit: 5 })
      if (!res.ok) throw new Error(res.error || 'Failed to load workers')
      return res.data
    },
    cacheKey: 'home:recent-workers',
    ttl: 30 * 60 * 1000,
  })

  const {
    data: myRequests,
    isLoading: loadingRequests,
  } = useStaleWhileRevalidate({
    queryKey: ['contact-requests', 'mine'],
    queryFn: async () => {
      const res = await contactRequestsApi.getMyRequests()
      if (!res.ok) throw new Error(res.error || 'Failed to load requests')
      return res.data
    },
    cacheKey: 'home:my-requests',
    ttl: 10 * 60 * 1000,
  })

  const displayName = user ? `${user.firstName}` : 'there'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="home-screen"
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText} testID="greeting-text">
          Hello, {displayName} 👋
        </Text>
        <Text style={styles.subtitle}>Find skilled workers near you</Text>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.tile}
          onPress={onNavigateToDiscovery}
          testID="discover-tile"
          accessibilityLabel="Discover Workers"
        >
          <Text style={styles.tileIcon}>🔍</Text>
          <Text style={styles.tileLabel}>Discover</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tile}
          onPress={onNavigateToProfile}
          testID="profile-tile"
          accessibilityLabel="My Profile"
        >
          <Text style={styles.tileIcon}>👤</Text>
          <Text style={styles.tileLabel}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tile}
          onPress={onNavigateToWallet}
          testID="wallet-tile"
          accessibilityLabel="My Wallet"
        >
          <Text style={styles.tileIcon}>💳</Text>
          <Text style={styles.tileLabel}>Wallet</Text>
        </TouchableOpacity>
      </View>

      {/* Recent workers */}
      <Text style={styles.sectionTitle}>Recent Workers</Text>
      {loadingWorkers ? (
        <ActivityIndicator
          size="small"
          color="#007AFF"
          style={styles.spinner}
          testID="workers-loading"
        />
      ) : workersError ? (
        <Text style={styles.errorText} testID="workers-error">
          Could not load workers. Pull to refresh.
        </Text>
      ) : !recentWorkers || (recentWorkers as any[]).length === 0 ? (
        <View testID="workers-empty">
          <Text style={styles.emptyText}>No workers found nearby.</Text>
        </View>
      ) : (
        <FlatList
          data={recentWorkers as any[]}
          scrollEnabled={false}
          keyExtractor={(item: any) => item.id}
          testID="workers-list"
          renderItem={({ item }: { item: any }) => (
            <View style={styles.workerRow} testID={`worker-row-${item.id}`}>
              <Text style={styles.workerName}>{item.name}</Text>
              <Text style={styles.workerMeta}>
                {item.category} · {item.location}
              </Text>
            </View>
          )}
        />
      )}

      {/* Pending contact requests summary */}
      {!loadingRequests && myRequests && (myRequests as any[]).length > 0 && (
        <View style={styles.requestsBadge} testID="pending-requests">
          <Text style={styles.requestsText}>
            {(myRequests as any[]).length} pending contact request
            {(myRequests as any[]).length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16 },
  greeting: { marginBottom: 24 },
  greetingText: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 4 },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  tile: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tileIcon: { fontSize: 28, marginBottom: 6 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },
  spinner: { alignSelf: 'center', marginVertical: 12 },
  errorText: { color: '#FF4444', fontSize: 14, textAlign: 'center' },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', marginVertical: 12 },
  workerRow: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  workerName: { fontSize: 15, fontWeight: '600', color: '#333' },
  workerMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  requestsBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  requestsText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
})
