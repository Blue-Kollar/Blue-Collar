# Components Documentation

This directory contains all React components for the Blue-Collar application.

## Component Categories

### Core Components
- **WorkerForm**: Main form for worker registration/profile editing
  - Decomposed into: WorkerBasicInfo, WorkerContactInfo, WorkerWalletInfo
- **ImageUpload**: Image upload with editing capabilities (crop, rotate, flip)
  - Uses custom hook: useImageProcessing

### UI Components (Shared Library)
Located in `ui/` directory - reusable design system components:
- Button
- Card
- Dialog
- Dropdown Menu
- Input
- Sheet
- Badge

### Feature Components
- **WorkerCard**: Displays worker information
- **WorkerMap**: Map view of workers
- **SearchAutocomplete**: Search with autocomplete
- **TransactionHistory**: Payment/transaction history
- **NotificationDropdown**: User notifications
- **WorkerHeader**: Profile header with avatar, verification, and quick actions
- **WorkerContactDetails**: Worker address, email, and phone details
- **WorkerTipSection**: Wallet tipping and transaction history section

### Form Components
- **FormField**: Reusable form field wrapper
- **PasswordStrength**: Password strength indicator
- **StarRating**: Rating component

### Utility Components
- **Skeleton**: Loading placeholder
- **Toast**: Notification messages
- **ZoomableAvatar**: Interactive avatar component
- **LoadingState**: Shared loading indicator for client-side data fetching. Use `variant="block"` (default) for a centered full-area spinner, or `variant="inline"` for a compact in-flow spinner (e.g. "load more" rows). Accepts an optional `message`.
  ```tsx
  <LoadingState message="Loading workers…" />
  <LoadingState variant="inline" message="Loading more…" />
  ```
- **ErrorState**: Shared error display for failed data fetches, pairing with `LoadingState`. Use `variant="block"` (default) for a centered card with icon/title/message, or `variant="inline"` for a compact banner. Pass `onRetry` to show a retry button/link; omit it to hide retry.
  ```tsx
  <ErrorState title="Something went wrong" message={error.message} onRetry={refetch} />
  <ErrorState variant="inline" message={error.message} onRetry={refetch} />
  ```
  Prefer these over ad hoc `Loader2`/`AlertTriangle` + hand-rolled markup for any screen that fetches data client-side.

## State Management

All shared/global state lives in a single store pattern. Do not introduce new state libraries or ad hoc global state.

### Store Location
- Stores live in `src/stores/` (one file per domain slice, e.g. `workerStore.ts`, `notificationStore.ts`).
- Each slice is created with the same factory/pattern and exported as a typed hook.
- Local, component-only UI state (e.g. an open/closed toggle) may stay in `useState`; anything shared across routes or components belongs in a store slice.

### Reading and Writing State
- Components read state via **selectors**, not by receiving props drilled down from parents:
  ```tsx
  const workers = useWorkerStore((s) => s.workers);
  const isLoading = useWorkerStore((s) => s.isLoading);
  ```
- Components write state via **actions** exposed on the store:
  ```tsx
  const setWorkers = useWorkerStore((s) => s.setWorkers);
  ```
- Select narrowly (one value per selector call) to avoid unnecessary re-renders.
- Do not pass store values or setters through multiple component layers. If a deep child needs shared state, it should read the store directly.

### Migrating Away from Prop Drilling
- When refactoring, move shared state into the appropriate slice and replace prop chains with selector reads.
- Keep components that are genuinely presentational (no shared state) prop-driven.

## Error Boundaries

Route-level crashes are contained by an `ErrorBoundary` so a single failing route does not blank the whole app.

### Usage
- `ErrorBoundary` is a class component that catches render/lifecycle errors in its subtree and renders a fallback UI.
- Wrap each route element with `ErrorBoundary` (typically in the router configuration or a shared route layout):
  ```tsx
  <ErrorBoundary fallback={<RouteErrorFallback />}>
    <WorkersRoute />
  </ErrorBoundary>
  ```
- The fallback should offer a recovery action (e.g. "Try again" that resets the boundary, or a link back to a safe route).
- Boundaries do not catch errors in event handlers or async code; handle those with local error state (see `ErrorState`).

### Testing
- Fallback UI tests live alongside the boundary in `__tests__/`. Render a child that throws and assert the fallback renders and the recovery action works.

## Recent Refactoring

### ImageUpload Component
- **Before**: 239 lines, all logic inline
- **After**: 149 lines, logic extracted to `useImageProcessing` hook
- **Benefits**: Reusable image processing logic, cleaner component

### WorkerForm Component
- **Before**: 223 lines, all form fields inline
- **After**: 101 lines, decomposed into sub-components
- **Benefits**: Better maintainability, reusable form sections

### Dead Code Cleanup
- Removed unused components and assets identified by `knip`.
- Run `knip` before adding new components to catch dead exports early.

## Component Guidelines

1. **Single Responsibility**: Each component should have one clear purpose
2. **Composition over Inheritance**: Use composition for complex UIs
3. **Custom Hooks**: Extract complex logic into reusable hooks
4. **Shared Library**: Use `ui/` components for consistent design
5. **State**: Use store slices with selectors; avoid prop drilling for shared state
6. **Resilience**: Wrap routes with `ErrorBoundary`
7. **Documentation**: Update this file when adding new components

## Testing

Components should have corresponding test files in `__tests__/` directory.