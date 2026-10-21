# Pull Request: Move Fee Calculation into Domain Module (#1640)

## Overview

Extract fee calculation logic into pure domain functions with comprehensive testing and documentation. This module is shared with contract expectations to ensure consistency across TypeScript backend and Rust smart contracts.

## Changes

### 1. Core Domain Module (`src/domain/fees.ts`)

Pure functions for canonical fee calculations:

- **`calculateFee(amount, feeBps)`**: Core fee calculation with floor rounding
  - Formula: `floor(amount * feeBps / 10_000)`
  - Validates basis points range [0, 10_000]
  - Returns integer stroops

- **`splitFee(amount, feeBps)`**: Splits amount into fee and net
  - Guarantees: `fee + net = amount` (balance conservation)
  - Returns tuple `[fee, net]`

- **`bpsShare(amount, bps)`**: Basis-point weighted distribution
  - Used for per-recipient fee distribution
  - Same floor rounding as calculateFee

- **Validation functions**:
  - `validateBasisPoints(bps)`: Throws RangeError if invalid
  - `isValidBasisPoints(bps)`: Type-guard predicate

- **Invariant checks** (for testing/debugging):
  - `invariantBalanceConserved(amount, feeBps)`
  - `invariantFeeNeverExceedsAmount(amount, feeBps)`
  - `invariantNetNeverNegative(amount, feeBps)`

### 2. Comprehensive Testing

#### Unit Tests (`fees.test.ts`)
- 50+ test cases covering:
  - Basic calculations (2.5%, 5%, 1%, 0%, 100% fees)
  - Rounding behavior (floor on fractional stroops)
  - Edge cases (0 amount, 1 amount, MAX_SAFE_INTEGER)
  - Balance conservation
  - Error validation
  - All function signatures

#### Property-Based Tests (`fees.property.test.ts`)
- Verifies 7 mathematical invariants across all valid inputs:

| Invariant | Property | Coverage |
|-----------|----------|----------|
| Balance Conservation | fee + net = amount | 500+ input combinations |
| Fee Bounds | 0 ≤ fee ≤ amount | All valid bps values |
| Net Bounds | 0 ≤ net ≤ amount | All valid bps values |
| Floor Rounding | fee = ⌊amount × bps / 10_000⌋ | All inputs |
| Monotonicity | Higher bps/amount → higher fee | Continuous verification |
| Integer Arithmetic | All results ∈ ℤ | All inputs |
| Finite Results | No NaN or Infinity | Tested with MAX_SAFE_INTEGER |

### 3. Service Integration

Refactored `payment.service.ts`:
- Imports `calculateFee` from domain module
- Delegates fee calculations to domain functions
- Uses domain `validateBasisPoints` for validation
- Converts domain `RangeError` to service-layer `AppError`
- Maintains backward compatibility with existing tests

### 4. Documentation

`FEE_CALCULATION.md` includes:
- Seven core invariants explained with formulas
- Basis points scale and valid ranges
- Contract alignment with Rust implementations
- Usage examples for all functions
- Testing strategy and coverage
- Error handling patterns
- Migration guide from old implementation

## Mathematical Invariants

### 1. Balance Conservation ✓
```typescript
const [fee, net] = splitFee(amount, feeBps)
fee + net === amount  // Always true
```

### 2. Fee Bounds ✓
```typescript
const fee = calculateFee(amount, feeBps)
0 <= fee && fee <= amount  // Always true
```

### 3. Net Bounds ✓
```typescript
const [_fee, net] = splitFee(amount, feeBps)
0 <= net && net <= amount  // Always true
```

### 4. Floor Rounding ✓
```typescript
const fee = calculateFee(amount, feeBps)
fee === Math.floor((amount * feeBps) / 10_000)  // Always true
```

### 5. Monotonicity ✓
- Higher bps → higher fee (for fixed amount)
- Higher amount → higher fee (for fixed bps)

### 6. Integer Arithmetic ✓
```typescript
const fee = calculateFee(amount, feeBps)
Number.isInteger(fee)  // Always true (no fractional stroops)
```

### 7. Finite Results ✓
```typescript
const fee = calculateFee(amount, feeBps)
Number.isFinite(fee)  // Always true (no NaN/Infinity)
```

## Contract Alignment

Matches Rust canonical implementations in `contracts/types/src/helpers.rs`:

### TypeScript
```typescript
calculateFee(amount, bps) = Math.floor((amount * bps) / 10_000)
splitFee(amount, bps) = [calculateFee(amount, bps), amount - calculateFee(amount, bps)]
```

### Rust
```rust
fn split_fee(amount: i128, fee_bps: u32) -> (i128, i128) {
    let fee = amount * (fee_bps as i128) / 10_000;
    let net = amount - fee;
    (fee, net)
}
```

**Why Important:** Fee calculations must match exactly between layers. A 1-stroop difference would cause contract rejections.

## Testing Summary

```
Unit Tests:        50+ test cases
Property Tests:    500+ input combinations
Total Coverage:    ~550 test cases
Properties:        7 core mathematical invariants
```

## Usage Examples

### Calculate a fee
```typescript
import { calculateFee } from '@/domain/fees'

const fee = calculateFee(10_000_000, 250)  // 1 XLM at 2.5%
// → 25_000 stroops (0.0025 XLM)
```

### Split an amount
```typescript
import { splitFee } from '@/domain/fees'

const [fee, net] = splitFee(10_000_000, 250)
// fee → 25_000, net → 9_975_000
// fee + net → 10_000_000 ✓
```

### Distribute a share
```typescript
import { bpsShare } from '@/domain/fees'

const totalFee = 25_000
const share1 = bpsShare(totalFee, 6_000)  // 60%
const share2 = bpsShare(totalFee, 4_000)  // 40%
// share1 → 15_000, share2 → 10_000
```

## Backward Compatibility

✓ All existing tests pass  
✓ Public API unchanged  
✓ Error handling preserved  
✓ Module-level functions maintained  
✓ Service class functionality unchanged  

## Files Changed

```
 5 files changed, 1212 insertions(+), 7 deletions(-)
 
 create mode 100644 packages/api/src/domain/FEE_CALCULATION.md
 create mode 100644 packages/api/src/domain/fees.property.test.ts
 create mode 100644 packages/api/src/domain/fees.test.ts
 create mode 100644 packages/api/src/domain/fees.ts
 modify mode 100644 packages/api/src/services/payment.service.ts
```

## Checklist

- [x] Pure functions with no side effects
- [x] Comprehensive unit tests (50+ cases)
- [x] Property-based tests (500+ inputs)
- [x] Mathematical invariants documented
- [x] Contract alignment verified
- [x] Backward compatibility maintained
- [x] Error handling proper
- [x] Documentation complete
- [x] All existing tests passing

## Benefits

✓ **Reusability**: Pure functions can be used anywhere  
✓ **Testability**: Comprehensive coverage of edge cases  
✓ **Reliability**: Mathematical properties verified  
✓ **Clarity**: Clear invariant documentation  
✓ **Maintainability**: Single source of truth for fee logic  
✓ **Consistency**: Shared with contract expectations  

## Related Issues

- Closes #1640
- Related to #1590 (Rounding consistency)
- Reference #1050 (Similar refactor with adapter pattern)

## Reviewer Notes

1. **Domain Module Structure**: Pure functions with zero dependencies on service layer
2. **Test Strategy**: 
   - Unit tests verify specific behaviors
   - Property tests ensure invariants hold across all inputs
3. **Error Handling**: Domain raises `RangeError`, service converts to `AppError`
4. **Backward Compatibility**: Existing code continues to work without changes
5. **Documentation**: See `FEE_CALCULATION.md` for detailed invariant explanations

## Questions?

See documentation in:
- `packages/api/src/domain/FEE_CALCULATION.md` - Complete invariant guide
- `packages/api/src/domain/fees.ts` - Annotated source code
- `packages/api/src/domain/fees.test.ts` - Unit test examples
- `packages/api/src/domain/fees.property.test.ts` - Property test patterns
