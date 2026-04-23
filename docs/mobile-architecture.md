# Mobile App Architecture — BlueCollar React Native

This document defines the planned architecture, feature set, technology choices, screen wireframes, offline strategy, and push notification approach for the BlueCollar mobile app.

---

## Feature Set

The mobile app targets workers and users who need on-the-go access to the BlueCollar platform.

### Core Features

| Feature                  | User | Worker/Curator |
| ------------------------ | ---- | -------------- |
| Browse & search workers  | ✓    |                |
| Filter by category       | ✓    |                |
| View worker profiles     | ✓    |                |
| Bookmark workers         | ✓    |                |
| Send contact requests    | ✓    |                |
| Leave reviews            | ✓    |                |
| Send tips (Stellar)      | ✓    |                |
| Create escrow payments   | ✓    |                |
| Register/manage profile  |      | ✓              |
| Set availability         |      | ✓              |
| View contact requests    |      | ✓              |
| Receive push alerts      | ✓    | ✓              |
| QR code share/scan       | ✓    | ✓              |
| Wallet connect (Freighter)|     | ✓              |

### Auth Features
- Email/password login and registration
- Google OAuth (via in-app browser)
- Email verification flow
- Password reset via deep link

### Offline Features
- Cached worker profiles and bookmarks (readable offline)
- Queued contact requests (sent when back online)
- Offline-aware UI states

---

## Technology Stack

| Concern              | Choice                          | Rationale                                                  |
| -------------------- | ------------------------------- | ---------------------------------------------------------- |
| Framework            | React Native (Expo SDK 51+)     | Shared JS logic with web app, fast iteration, OTA updates  |
| Navigation           | Expo Router (file-based)        | Mirrors Next.js routing, familiar to the web team          |
| State management     | Zustand                         | Lightweight, no boilerplate, works well with async storage |
| Server state         | TanStack Query (React Query)    | Caching, background refetch, offline support built-in      |
| Styling              | NativeWind (Tailwind for RN)    | Reuse Tailwind class knowledge from the web app            |
| Forms                | React Hook Form + Zod           | Same validation stack as the web app                       |
| Stellar wallet       | Freighter mobile SDK / WalletConnect | Wallet signing on mobile                              |
| Push notifications   | Expo Notifications + FCM/APNs   | Cross-platform, integrates with existing web-push service  |
| Offline storage      | MMKV (via react-native-mmkv)    | Faster than AsyncStorage, synchronous reads                |
| Background sync      | Expo TaskManager                | Queue and retry failed requests in background              |
| Image handling       | Expo Image + expo-image-picker  | Optimized caching, lazy loading, camera/gallery access     |
| QR codes             | expo-barcode-scanner + react-native-qrcode-svg | Scan and generate QR codes             |
| HTTP client          | Same `lib/api.ts` (fetch-based) | Reuse existing API client with minor RN adaptations        |
| Testing              | Jest + React Native Testing Library | Consistent with web test patterns                     |
| CI/CD                | EAS Build + EAS Submit          | Managed builds and store submissions via Expo              |

---

## Screen Wireframes

Wireframes are described as component trees. Visual mockups should be created in Figma referencing these layouts.

### 1. Home / Worker Discovery

```
<SafeAreaView>
  <SearchBar placeholder="Search workers..." />
  <CategoryScrollRow>
    <CategoryChip icon="🔧" label="Plumber" />
    <CategoryChip icon="⚡" label="Electrician" />
    ...
  </CategoryScrollRow>
  <FlatList
    data={workers}
    renderItem={<WorkerCard
      avatar, name, category, location, rating, isVerified
      onPress → WorkerProfile
      onBookmark → toggle bookmark
    />}
    onEndReached → load next page
  />
</SafeAreaView>
```

### 2. Worker Profile

```
<ScrollView>
  <HeroSection avatar, name, category, location, verifiedBadge />
  <RatingRow stars, reviewCount />
  <BioSection text />
  <AvailabilityGrid days, times />
  <ActionRow>
    <ContactButton → ContactRequestModal />
    <TipButton → TipModal />
    <BookmarkButton />
    <ShareButton → QR / deep link />
  </ActionRow>
  <ReviewList>
    <ReviewCard author, rating, comment, date />
    ...
  </ReviewList>
  <WriteReviewButton → ReviewFormModal />
</ScrollView>
```

### 3. TipModal (bottom sheet)

```
<BottomSheet>
  <WorkerMiniCard avatar, name />
  <AmountInput keyboardType="decimal-pad" />
  <TokenSelector (XLM / custom asset) />
  <FeeBreakdown workerReceives, protocolFee />
  <ConnectWalletButton (if not connected) />
  <ConfirmButton → Stellar transaction />
  <TransactionStatus pending | success | error />
</BottomSheet>
```

### 4. Dashboard (Curator/Worker)

```
<TabNavigator>
  <Tab name="My Profile">
    <WorkerFormScreen (edit profile, availability) />
  </Tab>
  <Tab name="Requests">
    <ContactRequestList status=pending|accepted|declined />
  </Tab>
  <Tab name="Bookmarks">
    <BookmarkedWorkerList />
  </Tab>
</TabNavigator>
```

### 5. Auth Screens

```
LoginScreen:
  <Logo />
  <EmailInput />
  <PasswordInput />
  <LoginButton />
  <GoogleSignInButton />
  <ForgotPasswordLink → ForgotPasswordScreen />
  <RegisterLink → RegisterScreen />

RegisterScreen:
  <FirstNameInput /> <LastNameInput />
  <EmailInput /> <PasswordInput />
  <RegisterButton />
  → VerifyEmailScreen (check inbox prompt)
```

### 6. Notifications Screen

```
<FlatList
  data={notifications}
  renderItem={<NotificationRow
    icon, title, body, timestamp, read/unread indicator
    onPress → relevant screen (worker profile, request detail)
  />}
  ListEmptyComponent={<EmptyState />}
/>
```

---

## Offline Functionality

### Strategy: Cache-first with background sync

The app uses TanStack Query's `persistQueryClient` plugin backed by MMKV to persist query cache across app restarts.

```
┌─────────────────────────────────────────────┐
│                  App Launch                  │
│                                              │
│  1. Load cached data from MMKV immediately  │
│  2. Show stale UI while fetching fresh data │
│  3. Update UI when network response arrives │
└─────────────────────────────────────────────┘
```

### Cached data (readable offline)

- Worker profiles (last 50 viewed)
- Bookmarked workers (all)
- Category list
- User's own profile

### Queued writes (sent when online)

Use Expo TaskManager + a local queue in MMKV for actions taken offline:

```ts
// Offline queue entry shape
type QueuedAction = {
  id: string;
  type: "contact_request" | "bookmark" | "review";
  payload: unknown;
  createdAt: number;
  retries: number;
};
```

On reconnect, the background task drains the queue in order, retrying up to 3 times before surfacing an error to the user.

### Network state detection

```ts
import NetInfo from "@react-native-community/netinfo";

NetInfo.addEventListener((state) => {
  if (state.isConnected) drainOfflineQueue();
});
```

### Offline UI indicators

- Banner: "You're offline — showing cached data"
- Disabled state on write actions (tip, contact request) with tooltip: "Requires internet connection"
- Queued actions show a pending badge: "Will send when online"

---

## Push Notification Strategy

### Architecture

```
BlueCollar API (web-push / FCM)
        │
        ▼
  Expo Push Service
        │
   ┌────┴────┐
   ▼         ▼
 APNs       FCM
   │         │
   ▼         ▼
 iOS app  Android app
```

The existing API already has a `push.service.ts` and `PushSubscription` model. The mobile app registers an Expo push token instead of a Web Push subscription.

### Token registration

```ts
import * as Notifications from "expo-notifications";

async function registerPushToken(userId: string) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // POST to existing /api/push/subscribe endpoint
  await api.post("/push/subscribe", { token, platform: "mobile" });
}
```

### Notification types

| Event                        | Recipient  | Title                        |
| ---------------------------- | ---------- | ---------------------------- |
| New contact request received | Worker     | "New request from [name]"    |
| Contact request accepted     | User       | "[Worker] accepted your request" |
| Contact request declined     | User       | "[Worker] declined your request" |
| New review posted            | Worker     | "You received a new review"  |
| Escrow released              | Worker     | "Payment released to you"    |
| Escrow expiry reminder       | User       | "Your escrow expires soon"   |

### Foreground handling

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### Deep linking from notifications

Notifications include a `data.url` field that maps to Expo Router paths:

```ts
Notifications.addNotificationResponseReceivedListener((response) => {
  const url = response.notification.request.content.data?.url;
  if (url) router.push(url);
});
```

Example deep link targets:
- `/workers/[id]` — worker profile
- `/dashboard/requests/[id]` — contact request detail
- `/dashboard` — dashboard home

### Opt-out

Users can manage notification preferences in Settings → Notifications. Disabling sends a DELETE to `/api/push/unsubscribe` to remove the token server-side.
