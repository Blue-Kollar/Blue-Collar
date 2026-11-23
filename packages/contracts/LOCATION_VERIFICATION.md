# Worker Location Verification (#352)

## Overview

The location verification feature provides on-chain verification of worker location claims. This enables trustless verification of worker locations without storing raw PII on-chain.

## Architecture

### LocationVerification Struct

```rust
#[contracttype]
#[derive(Clone)]
pub struct LocationVerification {
    /// Verifier address (authorized to verify locations)
    pub verifier: Address,
    /// Unix timestamp when verification was recorded
    pub verified_at: u64,
    /// Unix timestamp when verification expires
    pub expires_at: u64,
}
```

### Storage

Location verifications are stored in persistent contract storage:

- **Key**: `DataKey::LocationVerification(worker_id)`
- **Value**: `LocationVerification` struct
- **TTL**: Managed by Soroban's storage TTL system

## API Reference

### verify_location()

Verify a worker's location on-chain.

```rust
pub fn verify_location(
    env: Env,
    verifier: Address,
    worker_id: Symbol,
    expires_at: u64,
)
```

**Parameters:**

- `verifier`: Address with verification authority (must call `require_auth()`)
- `worker_id`: The worker's unique identifier
- `expires_at`: Unix timestamp when verification expires

**Events:**

- Emits `("LocVfy", worker_id)` with data `(verifier, verified_at, expires_at)`

**Panics:**

- `"Worker not found"` if worker doesn't exist

**Example:**

```rust
let verifier = Address::generate(&env);
let worker_id = Symbol::new(&env, "worker123");
let expires_at = env.ledger().timestamp() + 86400 * 365; // 1 year

client.verify_location(&verifier, &worker_id, &expires_at);
```

### get_location_verification()

Retrieve the location verification record for a worker.

```rust
pub fn get_location_verification(
    env: Env,
    worker_id: Symbol,
) -> Option<LocationVerification>
```

**Parameters:**

- `worker_id`: The worker's unique identifier

**Returns:**

- `Some(LocationVerification)` if verified
- `None` if not verified

**Example:**

```rust
if let Some(verification) = client.get_location_verification(&worker_id) {
    println!("Verified by: {}", verification.verifier);
    println!("Verified at: {}", verification.verified_at);
    println!("Expires at: {}", verification.expires_at);
}
```

## Use Cases

### 1. Trusted Verifier Network

Establish a network of trusted verifiers who can verify worker locations:

```rust
// Admin grants verifier role
client.grant_role(&admin, &verifier_role, &verifier_address);

// Verifier confirms worker location
client.verify_location(&verifier, &worker_id, &expiry_timestamp);
```

### 2. Location-Based Service Discovery

Filter workers by verified location:

```rust
// Get worker
let worker = client.get_worker(&worker_id).unwrap();

// Check if location is verified
if let Some(verification) = client.get_location_verification(&worker_id) {
    if verification.expires_at > current_time {
        // Location is currently verified
        println!("Worker location verified by: {}", verification.verifier);
    }
}
```

### 3. Expiration Management

Handle verification expiration:

```rust
let verification = client.get_location_verification(&worker_id).unwrap();
let now = env.ledger().timestamp();

if verification.expires_at <= now {
    // Verification has expired, re-verify if needed
    client.verify_location(&verifier, &worker_id, &new_expiry);
}
```

## Privacy Considerations

### What's Stored On-Chain

- Verifier address (who verified)
- Verification timestamp (when verified)
- Expiration timestamp (when verification expires)

### What's NOT Stored On-Chain

- Actual location coordinates
- City/country names
- Any raw PII

The actual location data is stored off-chain in the BlueCollar API database, with only a SHA-256 hash stored on-chain (see `location_hash` in Worker struct).

## Integration with Off-Chain API

The location verification feature integrates with the BlueCollar API:

1. **Off-Chain Verification**: API verifies worker location claims
2. **On-Chain Recording**: Verification is recorded on-chain via `verify_location()`
3. **Expiration Handling**: API checks expiration and triggers re-verification if needed

### API Endpoints

```
POST /api/workers/:id/verify-location
- Verifies worker location
- Calls contract's verify_location()
- Records verification timestamp

GET /api/workers/:id/location-verification
- Retrieves verification status
- Checks expiration
- Returns verification details
```

## Gas Optimization

Location verification is optimized for minimal gas usage:

- **Compact Storage**: LocationVerification struct uses only 48 bytes
- **Single Write**: One storage write per verification
- **Efficient Events**: Uses `symbol_short!()` for event names
- **No Redundant Reads**: Verification is stored once and retrieved as needed

**Estimated Gas Cost**: ~3,500-4,000 operations per verification

## Testing

Comprehensive tests are included in the contract test suite:

```rust
#[test]
fn test_verify_location_stores_record() { ... }

#[test]
#[should_panic(expected = "Worker not found")]
fn test_verify_location_nonexistent_worker_panics() { ... }
```

## Future Enhancements

1. **Multi-Verifier Support**: Allow multiple verifiers per location
2. **Verification Levels**: Support different verification confidence levels
3. **Batch Verification**: Verify multiple workers in one transaction
4. **Verification History**: Track all verification attempts
5. **Geographic Zones**: Support zone-based verification

## References

- [Worker Registration](./README.md#worker-registration)
- [Privacy & Hashing](./README.md#privacy)
- [Gas Optimization](./GAS_OPTIMIZATION.md)
