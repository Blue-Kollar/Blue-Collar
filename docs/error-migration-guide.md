# Error Consolidation Migration Guide

## Overview
Error definitions have been consolidated into a single shared module: `contracts/shared/src/errors.rs`.

## Breaking Changes
This is a breaking change. All contracts must update their error handling.

### Before
```rust
// Old way - each contract had its own errors
use crate::error::ContractError;

fn transfer() -> Result<(), ContractError> {
    Err(ContractError::Unauthorized)
}
// New way - shared error types
use shared::errors::CommonError;

fn transfer() -> Result<(), CommonError> {
    Err(CommonError::Unauthorized)
}
