# State Management Consolidation Patterns

This document outlines the consolidated patterns for common state management scenarios in the app, preventing duplication across hooks.

## Async State Pattern (Loading/Error/Data)

### Use `useAsyncState` for async operations with loading and error states

```typescript
import { useAsyncState } from '@/hooks/useAsyncState'

// Basic usage
const { data, loading, error, execute, reset } = useAsyncState(fetchUsers)

// With lifecycle callbacks
const { data, loading, error, execute } = useAsyncState(fetchUsers, {
  onSuccess: () => toast.success('Users loaded'),
  onError: (error) => console.error(error),
})

// With type safety
const { data, loading, error, execute } = useAsyncState<User[], [string]>(
  (id: string) => fetchUserById(id)
)

useEffect(() => {
  execute(userId)
}, [userId, execute])
```

### When to use `useAsyncState`

- Single async function with loading/error/data states
- No complex state dependencies
- Need success/error callbacks
- Want to handle both success and error uniformly

### Existing implementations

| Hook | Uses Pattern | Status |
|------|-------------|--------|
| `useApi` | ✓ | Core pattern hook |
| `useTransactionList` | ✓ | Partially (has custom caching) |
| `usePushNotifications` | ✗ | Candidate for refactoring |
| `useOfflineActions` | ✗ | Candidate for refactoring |
| `useWorkerEvents` | ✗ | Complex (SSE fallback) - keep as-is |

## React Query Pattern (Preferred for data fetching)

For data fetching with caching, we use React Query:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'

// Queries (GET)
const { data, isLoading, error } = useQuery({
  queryKey: ['users', id],
  queryFn: () => fetchUser(id),
})

// Mutations (POST, PUT, DELETE)
const { mutate, isPending, error } = useMutation({
  mutationFn: (user: User) => updateUser(user),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
})
```

### When to use React Query

- Data fetching with caching needs
- Multiple request deduplication
- Background refetch on window focus
- Persistent cache

## Future Refactoring Candidates

### `usePushNotifications`
- Has multiple independent boolean states (isSupported, isSubscribed, isLoading)
- Candidate for reduction using useReducer or composing with useAsyncState

### `useOfflineActions`
- Repeated try-catch-toast pattern
- Could create a wrapper utility for queuing actions with toast feedback

### `useWorkerEvents`
- Handles both SSE and polling fallback - keep as specialized
- Document in place as-is
