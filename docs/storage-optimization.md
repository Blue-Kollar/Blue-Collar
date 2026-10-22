# Storage Key Optimization Guide

## Overview
This guide explains how to optimize storage keys in Soroban contracts to reduce footprint and gas costs.

## Why Optimize Storage Keys?

### Problem
- Long string-based keys use more storage
- Each byte of storage costs XLM
- Large keys increase contract size and deployment costs

### Solution
- Use compact enum-based keys
- Use short symbols instead of long strings
- Combine keys with small identifiers

## Key Optimization Strategies

### 1. Use Enums Instead of Strings

**Before (String-based):**
```rust
let key = Symbol::new(&env, "balance:user:123");
let key = CompactKey::Balance.to_symbol(&env);
let key = Symbol::new(&env, "ub"); // 2 bytes instead of 12
let key = Symbol::new(&env, &format!("product_{}", id));
let key = StorageKeyBuilder::new(&env, CompactKey::Product).with_id(id);
use shared::storage_keys::{CompactKey, keys};

// Store admin address
let admin_key = keys::admin(&env);
env.storage().instance().set(&admin_key, &admin);

// Store balance for a user
let balance_key = keys::balance(&env, &user);
env.storage().set(&balance_key, &balance);

// Store product data
let product_key = keys::product(&env, product_id);
env.storage().set(&product_key, &product);
use shared::storage_keys::StorageKeyBuilder;

let custom_key = StorageKeyBuilder::new(&env, CompactKey::Custom)
    .with_string("my_data");
env.storage().set(&custom_key, &data);
// Measure storage usage
let before = env.storage().instance().size();
// Store data with verbose keys
// Measure after
let after = env.storage().instance().size();
println!("Storage used: {} bytes", after - before);
// Measure storage usage
let before = env.storage().instance().size();
// Store data with verbose keys
// Measure after
let after = env.storage().instance().size();
println!("Storage used: {} bytes", after - before);
// Same measurement with compact keys
let before = env.storage().instance().size();
// Store data with compact keys
let after = env.storage().instance().size();
println!("Storage used: {} bytes (reduced!)", after - before);
// Old
let key = Symbol::new(&env, "admin");
// New
let key = CompactKey::Admin.to_symbol(&env);
// Old
let key = Symbol::new(&env, &format!("balance_{}", user));
// New
let key = StorageKeyBuilder::new(&env, CompactKey::Balance)
    .with_address(&user);
