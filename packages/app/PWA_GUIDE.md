# Progressive Web App (PWA) Implementation

BlueCollar is now a full-featured PWA with offline capabilities, background sync, and push notifications.

## Features Implemented

### 1. App Shell Caching

- Static assets cached on first visit
- Separate caching for shell, data, and images
- TTL-based expiry for cached data

### 2. Advanced Caching Strategies

| Route Pattern       | Strategy                          | TTL             |
| ------------------- | --------------------------------- | --------------- |
| `/api/workers/*`    | Stale-while-revalidate            | 50 entries max  |
| `/api/categories/*` | Cache-first                       | 7 days          |
| `/api/auth/*`       | Network-first                     | -               |
| Navigation (HTML)   | Network-first with shell fallback | -               |
| Images              | Cache-first                       | 100 entries max |
| Static assets       | Cache-first                       | -               |

### 3. Offline Action Queueing

When offline, failed requests are automatically queued via IndexedDB:

```typescript
import { useOfflineActions } from '@/hooks/useOfflineActions';

function MyComponent() {
  const { queueContactRequest, queueBookmarkChange } = useOfflineActions();

  // Queue a contact request
  await queueContactRequest(workerId, 'Can you help with plumbing?');

  // Queue a bookmark change
  await queueBookmarkChange(workerId, true);
}
```

**Supported Actions:**

- Contact requests → `POST /api/workers/:id/contact`
- Bookmark changes → `POST/DELETE /api/workers/:id/bookmark`
- Profile updates → `PATCH /api/users/me`

When the user comes back online, the service worker automatically syncs queued actions.

### 4. Background Sync

The service worker uses the Background Sync API to retry failed requests:

```javascript
// Automatic background sync registration (happens in service worker)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});
```

**Benefits:**

- Syncs even if user closes app
- Works on most modern browsers (Chrome, Edge, Brave)
- Graceful fallback on unsupported browsers

### 5. Push Notifications (Enhanced)

Improvements over the base implementation:

- Permission status tracking
- Better error messages
- Notification routing via `data.url`
- Reliable subscription management

```typescript
import { usePushNotifications } from "@/hooks/usePushNotifications";

function PushSettings() {
  const { isSubscribed, subscribe, unsubscribe, permissionStatus } = usePushNotifications();

  return (
    <div>
      <p>Permission: {permissionStatus}</p>
      <button onClick={subscribe} disabled={isSubscribed}>
        Enable Notifications
      </button>
    </div>
  );
}
```

### 6. Offline Indicator

The `OfflineBanner` component now shows:

- **Offline status** when disconnected
- **Sync progress** with action count when syncing
- **Pending changes** count when actions await sync

```typescript
import OfflineBanner from "@/components/OfflineBanner";

export default function RootLayout() {
  return (
    <>
      <OfflineBanner />
      {/* page content */}
    </>
  );
}
```

## Installation Instructions

### 1. Register Service Worker

Add to your root layout or main page:

```typescript
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export default function RootLayout() {
  return (
    <>
      <ServiceWorkerRegister />
      <OfflineBanner />
      {/* rest of layout */}
    </>
  );
}
```

### 2. Configure Environment Variables

Add VAPID keys for push notifications (generate from [web-push](https://www.npmjs.com/package/web-push)):

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
```

### 3. Install as PWA

**Desktop (Chrome/Edge):**

- Address bar → Install button or menu → "Install app"

**Mobile (Android/iOS):**

- Chrome/Safari → Menu → "Add to Home Screen" or "Install app"

After installation, the app will:

- Load instantly (cached app shell)
- Work offline
- Receive push notifications
- Show in app drawer alongside native apps

## Testing Offline Functionality

### 1. Simulate Offline in DevTools

```
DevTools → Network tab → Check "Offline" → Refresh page
```

### 2. Test Background Sync (Chrome)

```
DevTools → Application → Service Workers → Check "Offline"
→ Perform offline action → Uncheck "Offline"
→ Action automatically syncs
```

### 3. Test Push Notifications

```bash
# Generate VAPID keys
npm install -g web-push
web-push generate-vapid-keys

# Send test notification to subscribed user (backend)
const webpush = require('web-push');
webpush.setVapidDetails(
  'mailto:admin@bluecollar.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);
await webpush.sendNotification(subscription, {
  title: "Test Notification",
  body: "This is a test"
});
```

## Lighthouse PWA Audit

Run the audit:

```
DevTools → Lighthouse → PWA → Analyze page load
```

Expected score: **90+**

Key checks:

- ✅ Installable (manifest + icons)
- ✅ Works offline (service worker)
- ✅ Mobile-friendly (viewport meta)
- ✅ HTTPS (required for service workers)
- ✅ Safe (HTTPS + CSP headers)

## Architecture

### Service Worker Flow

```
User Request
    ↓
Route Pattern Match
    ├─ /api/workers → Stale-while-revalidate
    ├─ /api/categories → Cache-first (7d TTL)
    ├─ /api/auth → Network-first
    ├─ Navigation → Network-first + shell fallback
    ├─ Images → Cache-first (limit 100)
    └─ Static → Cache-first
    ↓
Offline? → Queue via IndexedDB
    ↓
Online? → Background Sync API
    ↓
✓ Success: Remove from queue, notify client
✗ Failure: Keep in queue, retry on next sync
```

### Offline Action Queue

```
User Action (Offline)
    ↓
queueOfflineAction() → Store in IndexedDB
    ↓
Service Worker: sync event triggered
    ↓
Retry all queued actions with stored request
    ↓
On success: Delete from queue, postMessage to client
On failure: Keep queued, retry on next sync trigger
```

## Browser Support

| Feature            | Chrome | Edge | Firefox | Safari       |
| ------------------ | ------ | ---- | ------- | ------------ |
| Service Workers    | ✅     | ✅   | ✅      | ✅ (11+)     |
| Cache API          | ✅     | ✅   | ✅      | ✅ (11+)     |
| Background Sync    | ✅     | ✅   | ❌      | ❌           |
| Push Notifications | ✅     | ✅   | ✅      | ⚠️ (desktop) |
| IndexedDB          | ✅     | ✅   | ✅      | ✅           |

## Performance Impact

**Cache Storage Usage (typical user):**

- Shell cache: ~2-5 MB (static assets)
- Data cache: ~3-10 MB (worker profiles, 50 entries)
- Image cache: ~10-20 MB (100 high-res images)
- **Total**: ~15-35 MB (within browser limits)

**Network Savings:**

- App shell: Instant load on repeat visits (0ms → ~2s network save)
- Static assets: 100% cached (eliminates 50-100 requests)
- Worker data: Served from cache while refreshing

## Troubleshooting

### Service Worker Not Updating

Clear cache and hard refresh:

```
DevTools → Application → Clear Storage → Unregister → Ctrl+Shift+R
```

### Offline Actions Not Syncing

Check browser console for errors:

```javascript
// In DevTools console
navigator.serviceWorker.controller?.postMessage({ type: 'DEBUG' });
```

### Cache Too Large

Adjust `MAX_*_CACHE_SIZE` in `public/sw.js`:

```javascript
const MAX_DATA_CACHE_SIZE = 50; // Reduce to 30 for smaller devices
const MAX_IMG_CACHE_SIZE = 100; // Reduce to 50
```

### Push Notifications Not Working

1. Check VAPID key in `.env.local`
2. Verify permission status: `DevTools → Application → Manifest → Permissions`
3. Check backend subscription API response

## Files Modified

| File                                | Changes                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `public/sw.js`                      | Enhanced caching, background sync, TTL management         |
| `public/manifest.json`              | Added shortcuts, proper icons, categories                 |
| `src/hooks/usePushNotifications.ts` | Permission tracking, better UX                            |
| `src/hooks/useOfflineActions.ts`    | **NEW** - Queue offline actions                           |
| `src/lib/offlineQueue.ts`           | **NEW** - IndexedDB queue manager                         |
| `src/components/OfflineBanner.tsx`  | Shows sync progress, pending count                        |
| `next.config.mjs`                   | Added PWA headers (cache control, service-worker-allowed) |

## Next Steps

1. Generate VAPID keys and add to `.env.local`
2. Test offline functionality with DevTools
3. Run Lighthouse PWA audit
4. Deploy to production (HTTPS required)
5. Monitor offline action success rate via analytics

## References

- [PWA Checklist](https://web.dev/pwa/)
- [Background Sync API](https://developer.chrome.com/blog/background-sync-api/)
- [Push Notifications](https://web.dev/push-notifications-overview/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
