# Worker Certification Tracking Implementation

## Overview

This document describes the implementation of worker certification tracking for the BlueCollar Registry Contract (Issue #350).

## Data Structures

### Certification

```rust
#[contracttype]
#[derive(Clone)]
pub struct Certification {
    /// Unique certification identifier.
    pub id: Symbol,
    /// Worker who holds this certification.
    pub worker_id: Symbol,
    /// Certification name/title (e.g., "Licensed Electrician").
    pub name: String,
    /// Issuing organization (e.g., "State Board of Electricians").
    pub issuer: String,
    /// Certification number/reference.
    pub cert_number: String,
    /// Unix timestamp when certification was issued.
    pub issued_at: u64,
    /// Unix timestamp when certification expires (0 = no expiry).
    pub expires_at: u64,
    /// Whether this certification is currently valid.
    pub is_verified: bool,
    /// Address that verified this certification.
    pub verified_by: Option<Address>,
}
```

### Storage Keys

```rust
#[contracttype]
pub enum DataKey {
    // ... existing keys ...
    /// Persistent storage — certifications for a worker.
    Certifications(Symbol),  // worker_id
    /// Persistent storage — individual certification.
    Certification(Symbol),   // certification_id
}
```

## Functions

### add_certification

Add a new certification for a worker. Owner only.

```rust
pub fn add_certification(
    env: Env,
    caller: Address,
    worker_id: Symbol,
    cert_id: Symbol,
    name: String,
    issuer: String,
    cert_number: String,
    issued_at: u64,
    expires_at: u64,
) -> Certification
```

**Parameters:**

- `caller`: Must be the worker's owner; `require_auth()` is enforced
- `worker_id`: The worker's unique identifier
- `cert_id`: Unique certification identifier
- `name`: Certification name/title
- `issuer`: Issuing organization
- `cert_number`: Certification number/reference
- `issued_at`: Unix timestamp when issued
- `expires_at`: Unix timestamp when expires (0 = no expiry)

**Returns:** The created `Certification` struct

**Events:** Emits `("CertAdd", worker_id, cert_id)` with data `(name, issuer, expires_at)`

**Panics:**

- `"Worker not found"` if worker doesn't exist
- `"Not authorized"` if caller is not the worker's owner
- `"Certification already exists"` if cert_id already exists
- `"Invalid expiry"` if expires_at is in the past

### remove_certification

Remove a certification from a worker. Owner only.

```rust
pub fn remove_certification(
    env: Env,
    caller: Address,
    worker_id: Symbol,
    cert_id: Symbol,
) -> bool
```

**Parameters:**

- `caller`: Must be the worker's owner
- `worker_id`: The worker's unique identifier
- `cert_id`: Certification to remove

**Returns:** `true` if removed, `false` if not found

**Events:** Emits `("CertRem", worker_id, cert_id)` with data `()`

**Panics:**

- `"Worker not found"` if worker doesn't exist
- `"Not authorized"` if caller is not the worker's owner

### verify_certification

Verify a certification on-chain. Curator only.

```rust
pub fn verify_certification(
    env: Env,
    curator: Address,
    worker_id: Symbol,
    cert_id: Symbol,
) -> Certification
```

**Parameters:**

- `curator`: Must be an approved curator; `require_auth()` is enforced
- `worker_id`: The worker's unique identifier
- `cert_id`: Certification to verify

**Returns:** The updated `Certification` struct

**Events:** Emits `("CertVfy", worker_id, cert_id)` with data `(curator, timestamp)`

**Panics:**

- `"Caller is not a curator"` if curator is not approved
- `"Certification not found"` if cert_id doesn't exist
- `"Certification expired"` if expires_at is in the past

### get_certification

Get a specific certification.

```rust
pub fn get_certification(env: Env, cert_id: Symbol) -> Option<Certification>
```

**Returns:** The `Certification` struct if found, `None` otherwise

### get_worker_certifications

Get all certifications for a worker.

```rust
pub fn get_worker_certifications(env: Env, worker_id: Symbol) -> Vec<Certification>
```

**Returns:** A `Vec<Certification>` (may be empty)

### get_valid_certifications

Get all non-expired certifications for a worker.

```rust
pub fn get_valid_certifications(env: Env, worker_id: Symbol) -> Vec<Certification>
```

**Returns:** A `Vec<Certification>` filtered to only non-expired entries

### is_certification_valid

Check if a certification is currently valid (not expired).

```rust
pub fn is_certification_valid(env: Env, cert_id: Symbol) -> bool
```

**Returns:** `true` if certification exists and is not expired, `false` otherwise

## Events

### CertAdd (Certification Added)

- **Indexed**: `worker_id` (Symbol), `cert_id` (Symbol)
- **Data**: `(name: String, issuer: String, expires_at: u64)`
- **Emitted by**: `add_certification()`
- **Use case**: Track new certifications

### CertRem (Certification Removed)

- **Indexed**: `worker_id` (Symbol), `cert_id` (Symbol)
- **Data**: None
- **Emitted by**: `remove_certification()`
- **Use case**: Track certification removal

### CertVfy (Certification Verified)

- **Indexed**: `worker_id` (Symbol), `cert_id` (Symbol)
- **Data**: `(curator: Address, timestamp: u64)`
- **Emitted by**: `verify_certification()`
- **Use case**: Track certification verification

## Integration with Worker Struct

The `Worker` struct should be extended with:

```rust
pub struct Worker {
    // ... existing fields ...
    /// Array of certification IDs held by this worker.
    pub certifications: Vec<Symbol>,
}
```

## Usage Example

```rust
// Add a certification
let cert = contract.add_certification(
    &owner,
    &worker_id,
    &Symbol::new(&env, "cert_001"),
    &String::from_str(&env, "Licensed Electrician"),
    &String::from_str(&env, "State Board"),
    &String::from_str(&env, "EL-12345"),
    &1704067200,  // issued_at
    &1735689600,  // expires_at (1 year later)
);

// Verify the certification
contract.verify_certification(&curator, &worker_id, &Symbol::new(&env, "cert_001"));

// Get all valid certifications
let valid_certs = contract.get_valid_certifications(&worker_id);

// Check if specific certification is valid
let is_valid = contract.is_certification_valid(&Symbol::new(&env, "cert_001"));

// Remove a certification
contract.remove_certification(&owner, &worker_id, &Symbol::new(&env, "cert_001"));
```

## Expiration Handling

- Certifications with `expires_at = 0` never expire
- Certifications with `expires_at > 0` expire at that Unix timestamp
- `get_valid_certifications()` filters out expired entries
- `is_certification_valid()` checks expiration status
- Attempting to verify an expired certification panics

## Security Considerations

1. **Owner-only operations**: Only the worker's owner can add/remove certifications
2. **Curator verification**: Only approved curators can verify certifications
3. **Expiration validation**: Cannot add certifications with past expiry dates
4. **Immutable records**: Once verified, certification verification cannot be revoked (only removal)

## Storage Optimization

- Certifications are stored separately from Worker struct to avoid bloating worker entries
- Certification list is indexed by worker_id for efficient lookup
- Individual certifications are keyed by cert_id for direct access
- TTL extension applies to certification entries like other persistent data

## Backward Compatibility

- Existing Worker struct remains unchanged (certifications field added)
- Existing functions continue to work without modification
- New certification functions are additive only
