# PWA Quick Start

## 1. Enable Service Worker Registration

Add to your root layout (`src/app/[locale]/layout.tsx` or `src/app/layout.tsx`):

```typescript
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import OfflineBanner from "@/components/OfflineBanner";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ServiceWorkerRegister />
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
```

## 2. Setup VAPID Keys (Push Notifications)

Generate keys:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

Add to `.env.local`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
```

## 3. Use Offline Actions in Components

### Contact Workers Offline

```typescript
"use client";

import { useOfflineActions } from "@/hooks/useOfflineActions";
import { useState } from "react";

export function ContactForm({ workerId }) {
  const [message, setMessage] = useState("");
  const { queueContactRequest } = useOfflineActions();

  async function handleSubmit(e) {
    e.preventDefault();

    if (navigator.onLine) {
      // Send immediately
      await fetch(`/api/workers/${workerId}/contact`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
    } else {
      // Queue for offline
      await queueContactRequest(workerId, message);
    }

    setMessage("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Your message"
      />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Bookmark Workers Offline

```typescript
import { useOfflineActions } from "@/hooks/useOfflineActions";

export function BookmarkButton({ workerId, isBookmarked }) {
  const { queueBookmarkChange } = useOfflineActions();

  async function handleBookmark() {
    if (navigator.onLine) {
      await fetch(`/api/workers/${workerId}/bookmark`, {
        method: isBookmarked ? "DELETE" : "POST",
      });
    } else {
      await queueBookmarkChange(workerId, !isBookmarked);
    }
  }

  return <button onClick={handleBookmark}>Bookmark</button>;
}
```

## 4. Enable Push Notifications

```typescript
"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

export function NotificationSettings() {
  const { isSupported, isSubscribed, permissionStatus, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return <p>Not supported on this device</p>;

  return (
    <div>
      <p>Status: {permissionStatus}</p>
      {permissionStatus === "denied" && (
        <p>Enable notifications in browser settings</p>
      )}
      {!isSubscribed ? (
        <button onClick={subscribe}>Enable Notifications</button>
      ) : (
        <button onClick={unsubscribe}>Disable Notifications</button>
      )}
    </div>
  );
}
```

## 5. Test Locally

```bash
cd packages/app
pnpm dev
```

Then in your browser:

### Test Offline Mode

1. **Open DevTools** → `Application` tab
2. **Check "Offline"** under Service Workers
3. **Refresh** the page
4. **Perform actions** (contact, bookmark) — they queue in IndexedDB

### Test Background Sync

1. Queue an action while offline (above)
2. **Uncheck "Offline"**
3. Watch the console — you should see sync activity
4. Action automatically retries and succeeds

### Test Push Notifications

1. **Allow notifications** when prompted
2. **Send test notification** from your backend:

```javascript
const webpush = require('web-push');
const subscription = /* from database */;

await webpush.sendNotification(subscription, {
  title: "Test Notification",
  body: "This is a test",
  data: { url: "/workers" }
});
```

## 6. Install as App

After deploying:

### Desktop (Chrome/Edge)

- Click address bar → "Install app"

### Mobile (Android)

- Menu → "Install app" or "Add to Home Screen"

## 7. Verify PWA Score

```
DevTools → Lighthouse → PWA → Analyze page load
```

Expected: **90+ score**

## Files Changed

| File                                | Purpose                              |
| ----------------------------------- | ------------------------------------ |
| `public/sw.js`                      | Service worker with advanced caching |
| `public/manifest.json`              | PWA manifest with app shortcuts      |
| `src/lib/offlineQueue.ts`           | IndexedDB queue manager              |
| `src/hooks/useOfflineActions.ts`    | Hook to queue offline actions        |
| `src/hooks/usePushNotifications.ts` | Enhanced push notification hook      |
| `src/components/OfflineBanner.tsx`  | Shows offline/sync status            |
| `next.config.mjs`                   | PWA headers for service worker       |

## Monitoring Offline Queue

Check pending actions in console:

```javascript
const { getOfflineQueue } = await import('/src/lib/offlineQueue.js');
const queue = await getOfflineQueue();
console.log('Pending actions:', queue);
```

## Disable PWA Features

If you need to disable PWA features temporarily:

1. **Service Worker**: Comment out `<ServiceWorkerRegister />` in layout
2. **Offline Queue**: Don't call `queueOfflineAction()`
3. **Push Notifications**: Set VAPID key to empty string

## Troubleshooting

**Service Worker not updating?**

```javascript
// In DevTools console
navigator.serviceWorker.getRegistrations().then((registrations) => {
  registrations.forEach((r) => r.unregister());
});
// Then hard refresh: Ctrl+Shift+R
```

**Cache too large?**
Edit `public/sw.js`:

```javascript
const MAX_DATA_CACHE_SIZE = 30; // Reduce from 50
const MAX_IMG_CACHE_SIZE = 50; // Reduce from 100
```

**Offline actions not syncing?**
Check browser console for errors and verify backend endpoint availability.
