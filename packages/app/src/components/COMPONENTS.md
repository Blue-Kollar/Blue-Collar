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
- **ErrorBoundary**: Error handling wrapper
- **Skeleton**: Shared loading placeholder for skeletons and loading states. Use `variant="text"` (default) for text lines, `variant="block"` for rectangular blocks, or `variant="circle"` for avatars/icons. Accepts `width`, `height`, and `className` for sizing.
  ```tsx
  <Skeleton />
  <Skeleton variant="circle" width={40} height={40} />
  <Skeleton variant="block" height={120} />
  ```
- **EmptyState**: Shared empty-state display for screens with no data. Accepts `title`, optional `message`, optional `icon`, and optional `action` (e.g. a Button). Prefer this over ad hoc "no results" markup.
  ```tsx
  <EmptyState
    title="No workers found"
    message="Try adjusting your search filters."
    action={<Button onClick={resetFilters}>Clear filters</Button>}
  />
  ```
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

## Recent Refactoring

### ImageUpload Component
- **Before**: 239 lines, all logic inline
- **After**: 149 lines, logic extracted to `useImageProcessing` hook
- **Benefits**: Reusable image processing logic, cleaner component

### WorkerForm Component
- **Before**: 223 lines, all form fields inline
- **After**: 101 lines, decomposed into sub-components
- **Benefits**: Better maintainability, reusable form sections

## Design Tokens

All colors, spacings, radii, and typography values must come from the shared design-token module at `design-system/tokens.ts`. Do not hardcode hex colors, `rgb()`/`hsl()` values, or raw `px`/`rem` spacing literals in components or styles.

- **Colors**: use `tokens.colors.*` (e.g. `tokens.colors.primary`, `tokens.colors.text.muted`).
- **Spacing**: use `tokens.spacing.*` (e.g. `tokens.spacing.md`).
- **Radii / typography**: use `tokens.radii.*` and `tokens.typography.*`.
- **Tailwind**: prefer Tailwind utility classes that are backed by these tokens (configured in `tailwind.config`). Avoid arbitrary values like `bg-[#1a2b3c]` or `p-[13px]`.

```tsx
import { tokens } from "@/design-system/tokens";

const styles = {
  color: tokens.colors.text.primary,
  padding: tokens.spacing.md,
  borderRadius: tokens.radii.md,
};
```

```tsx
// Preferred: token-backed Tailwind classes
<div className="bg-primary text-foreground p-4 rounded-md" />
```

**Disallowed**: hardcoded hex/rgb/hsl color literals and raw pixel spacing values in component code. If a value is missing, add it to `design-system/tokens.ts` rather than inlining it.

## Component Guidelines

1. **Single Responsibility**: Each component should have one clear purpose
2. **Composition over Inheritance**: Use composition for complex UIs
3. **Custom Hooks**: Extract complex logic into reusable hooks
4. **Shared Library**: Use `ui/` components for consistent design
5. **Design Tokens**: Source all colors/spacings from `design-system/tokens.ts`; no hardcoded literals
6. **Loading & Empty States**: Use shared `LoadingState`, `Skeleton`, and `EmptyState` instead of ad hoc spinners/placeholders
7. **Documentation**: Update this file when adding new components

## Testing

Components should have corresponding test files in `__tests__/` directory.