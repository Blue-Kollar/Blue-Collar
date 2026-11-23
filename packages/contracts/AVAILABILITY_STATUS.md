# Worker Availability Status (#376)

## Overview

The availability status feature enables workers to manage their availability on-chain. Workers can update their availability status with optional expiration, supporting both immediate availability changes and scheduled availability windows.

## Architecture

### AvailabilityStatus Struct

```rust
#[contracttype]
#[derive(Clone)]
pub struct AvailabilityStatus {
    /// Whether worker is currently available
    pub is_available: bool,
    /// Unix timestamp of last availability update
    pub updated_at: u64,
    /// Unix timestamp when availability status expires (0 = no expiry)
    pub expires_at: u64,
}
```

### Storage

Availability statuses are stored in persistent contract storage:

- **Key**: `DataKey::AvailabilityStatus(worker_id)`
- **Value**: `AvailabilityStatus` struct
- **TTL**: Managed by Soroban's storage TTL system

## API Reference

### update_availability()

Update a worker's availability status.

```rust
pub fn update_availability(
    env: Env,
    id: Symbol,
    caller: Address,
    is_available: bool,
    expires_at: u64,
)
```

**Parameters:**

- `id`: The worker's unique identifier
- `caller`: Must be the worker's owner (must call `require_auth()`)
- `is_available`: New availability status (true = available, false = unavailable)
- `expires_at`: Unix timestamp when status expires (0 = no expiry)

**Events:**

- Emits `("AvlUpd", id)` with data `(is_available, updated_at, expires_at)`

**Panics:**

- `"Worker not found"` if worker doesn't exist
- `"Not authorized"` if caller is not the worker's owner

**Example:**

```rust
let worker_id = Symbol::new(&env, "worker123");
let now = env.ledger().timestamp();
let expires_in_24h = now + 86400;

// Set available for 24 hours
client.update_availability(&worker_id, &owner, &true, &expires_in_24h);
```

### get_availability()

Retrieve the availability status for a worker.

```rust
pub fn get_availability(
    env: Env,
    worker_id: Symbol,
) -> Option<AvailabilityStatus>
```

**Parameters:**

- `worker_id`: The worker's unique identifier

**Returns:**

- `Some(AvailabilityStatus)` if status has been set
- `None` if no status has been set

**Example:**

```rust
if let Some(status) = client.get_availability(&worker_id) {
    if status.is_available {
        println!("Worker is available");
        if status.expires_at > 0 {
            println!("Until: {}", status.expires_at);
        }
    } else {
        println!("Worker is unavailable");
    }
}
```

## Use Cases

### 1. Immediate Availability Toggle

Workers can quickly toggle their availability:

```rust
// Worker goes offline
client.update_availability(&worker_id, &owner, &false, &0);

// Worker comes back online
client.update_availability(&worker_id, &owner, &true, &0);
```

### 2. Scheduled Availability Windows

Workers can set availability for specific time periods:

```rust
let now = env.ledger().timestamp();
let work_hours_end = now + 28800; // 8 hours from now

// Available for next 8 hours
client.update_availability(&worker_id, &owner, &true, &work_hours_end);
```

### 3. Vacation/Leave Management

Workers can mark themselves unavailable for extended periods:

```rust
let now = env.ledger().timestamp();
let vacation_end = now + 86400 * 14; // 2 weeks

// Unavailable for 2 weeks
client.update_availability(&worker_id, &owner, &false, &vacation_end);
```

### 4. Availability-Based Filtering

Filter workers by current availability:

```rust
let now = env.ledger().timestamp();

if let Some(status) = client.get_availability(&worker_id) {
    let is_currently_available = status.is_available &&
        (status.expires_at == 0 || status.expires_at > now);

    if is_currently_available {
        // Include in available workers list
    }
}
```

## Availability Expiration Logic

### No Expiration (expires_at = 0)

Status remains active indefinitely until explicitly updated:

```rust
// Available indefinitely
client.update_availability(&worker_id, &owner, &true, &0);
```

### With Expiration

Status automatically expires at the specified timestamp:

```rust
let now = env.ledger().timestamp();
let expires_at = now + 3600; // 1 hour

// Available for 1 hour
client.update_availability(&worker_id, &owner, &true, &expires_at);

// After 1 hour, status is considered expired
// Client should check: status.expires_at > current_time
```

## Integration with Off-Chain API

The availability feature integrates with the BlueCollar API:

1. **Worker Updates**: Worker updates availability via API
2. **On-Chain Recording**: API calls contract's `update_availability()`
3. **Filtering**: API filters workers by availability status
4. **Expiration Handling**: API checks expiration and refreshes if needed

### API Endpoints

```
PUT /api/workers/:id/availability
- Updates worker availability
- Calls contract's update_availability()
- Records timestamp

GET /api/workers/:id/availability
- Retrieves availability status
- Checks expiration
- Returns current status

GET /api/workers?available=true
- Lists available workers
- Filters by availability status
- Respects expiration times
```

## Timestamp Management

### Current Time

Get current timestamp from Soroban ledger:

```rust
let now = env.ledger().timestamp();
```

### Calculating Expiration

Common time periods:

```rust
let now = env.ledger().timestamp();

// 1 hour
let expires_1h = now + 3600;

// 8 hours (work day)
let expires_8h = now + 28800;

// 24 hours (1 day)
let expires_24h = now + 86400;

// 7 days (1 week)
let expires_7d = now + 604800;

// 30 days (1 month)
let expires_30d = now + 2592000;
```

## Gas Optimization

Availability status updates are optimized for minimal gas usage:

- **Compact Storage**: AvailabilityStatus struct uses only 24 bytes
- **Single Write**: One storage write per update
- **Efficient Events**: Uses `symbol_short!()` for event names
- **No Redundant Reads**: Status is stored once and retrieved as needed

**Estimated Gas Cost**: ~3,400-3,800 operations per update

## Testing

Comprehensive tests are included in the contract test suite:

```rust
#[test]
fn test_update_availability_stores_status() { ... }

#[test]
fn test_update_availability_toggle() { ... }

#[test]
#[should_panic(expected = "Not authorized")]
fn test_update_availability_non_owner_panics() { ... }

#[test]
#[should_panic(expected = "Worker not found")]
fn test_update_availability_nonexistent_worker_panics() { ... }
```

## Best Practices

1. **Always Check Expiration**: When reading availability, verify expiration timestamp
2. **Use Appropriate Expiration**: Set realistic expiration times for use cases
3. **Batch Updates**: Update multiple workers' availability in single transaction if possible
4. **Monitor TTL**: Ensure availability records don't expire from storage
5. **Provide Feedback**: Notify workers when availability status expires

## Future Enhancements

1. **Availability Schedules**: Support recurring availability patterns
2. **Availability Reasons**: Store reason for unavailability (vacation, sick, etc.)
3. **Bulk Updates**: Update multiple workers' availability in one call
4. **Availability History**: Track availability changes over time
5. **Notifications**: Notify clients when worker availability changes
6. **Availability Slots**: Support specific time slots for availability

## References

- [Worker Registration](./README.md#worker-registration)
- [Gas Optimization](./GAS_OPTIMIZATION.md)
- [Location Verification](./LOCATION_VERIFICATION.md)
