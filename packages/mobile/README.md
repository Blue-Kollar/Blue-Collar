# BlueCollar Mobile App

React Native mobile application for the BlueCollar platform, built with Expo.

## Features
- Browse and search skilled workers
- View worker profiles and reviews
- Send contact requests
- Bookmark favorite workers
- Send tips (Stellar)
- Create escrow payments
- Push notifications
- Offline support with local caching
- Wallet integration

## Tech Stack
- **Framework**: React Native (Expo SDK 51+)
- **Navigation**: Expo Router (file-based)
- **State Management**: Zustand
- **Server State**: TanStack Query (React Query)
- **Styling**: NativeWind (Tailwind for RN)
- **Offline Storage**: MMKV
- **Network Monitoring**: @react-native-community/netinfo
- **Push Notifications**: Expo Notifications
- **Testing**: Jest + React Native Testing Library

## Project Structure
```
packages/mobile/
├── src/
│   ├── cache/           # Offline support & caching (Issue #840)
│   ├── lib/             # API client
│   ├── app/             # Expo Router screens
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── stores/          # Zustand stores
│   └── types/           # Global TypeScript types
├── assets/              # Images, fonts, etc.
├── app.json             # Expo configuration
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
└── README.md            # This file
```

## Getting Started
```bash
# Install dependencies
pnpm install

# Start the development server
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android

# Run tests
pnpm test
```

## Offline Support
The app implements comprehensive offline support (Issue #840):
- **Cached Data**: Worker profiles, bookmarks, categories, user profile
- **Offline Actions**: Contact requests, bookmarks, reviews, tips, escrow
- **Stale-While-Revalidate**: Shows cached data immediately, fetches fresh data in background
- **Action Queue**: Queues write operations when offline, syncs on reconnect
- **UI Indicators**: Clear offline/sync status banners

## Related Issues
- #837: [Mobile] React Native App Foundation
- #838: [Mobile] Mobile Wallet Integration (Stellar)
- #839: [Mobile] Push Notifications (FCM/APNs)
- #840: [Mobile] Offline Support & Local Caching ✅

## Architecture & Package Boundaries

- **[ADR 0001: Monorepo Package Boundaries](../../docs/adr/0001-monorepo-package-boundaries.md)** — defines monorepo package boundaries and import rules.

## License
MIT