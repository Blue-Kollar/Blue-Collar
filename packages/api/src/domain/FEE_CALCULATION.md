# Fee Calculation Domain Module

## Overview

The fee calculation module (`src/domain/fees.ts`) contains pure functions for calculating platform fees based on basis points (bps). This module is the canonical implementation shared with contract expectations and ensures consistency across the TypeScript backend and Rust smart contracts.

## Key Invariants

Fee calculations must satisfy these mathematical properties for all valid inputs:

### 1. Balance Conservation
**Property:** `fee + net ≡ amount`

The fee split must always conserve the total amount. For any valid calculation:
```typescript
const [fee, net] = splitFee(amount, feeBps)
fee + net === amount  // Always true
```

**Why:** Platform fees are deducted from the transaction amount, never added or lost. This ensures users can predict exact net received amounts.

**Test Coverage:** `fees.test.ts` verifies with multiple test cases; `fees.property.test.ts` verifies across all valid input combinations.

### 2. Fee Bounds
**Property:** `0 ≤ fee ≤ amount`

Fees are always non-negative and never exceed the transaction amount:
```typescript
const fee = calculateFee(amount, feeBps)
0 <= fee && fee <= amount  // Always true
```

**Why:** 
- Non-negative: Prevents "negative fees" (rebates) without explicit handling
- Upper bound: Floor rounding ensures fees never exceed the original amount

**Test Coverage:** `fees.property.test.ts` verifies across all valid basis points values (0 to 10_000).

### 3. Net Amount Bounds
**Property:** `0 ≤ net ≤ amount`

Net amounts are always non-negative and never exceed the original amount:
```typescript
const [_fee, net] = splitFee(amount, feeBps)
0 <= net && net <= amount  // Always true
```

**Why:** Combined with balance conservation, this ensures floor rounding never produces negative net amounts.

**Test Coverage:** `fees.property.test.ts` verifies with extremes (0 bps → full amount, 10_000 bps → zero net).

### 4. Floor Rounding
**Property:** `fee ≡ ⌊amount × bps / 10_000⌋`

Fee calculation uses floor rounding (truncation toward zero) consistently:
```typescript
const fee = calculateFee(amount, feeBps)
const manual = Math.floor((amount * feeBps) / 10_000)
fee === manual  // Always true
```

**Why:**
- **Consistency:** Matches Rust contract implementations (`split_fee`, `bps_share`)
- **Predictability:** Users can calculate expected fees without surprises
- **No rounding errors:** Stroop (smallest unit) is atomic; no fractional stroops

**Examples:**
```javascript
calculateFee(10_000, 250)  // → 250 (2.5%)
calculateFee(1, 500)       // → 0 (0.05% rounds down)
calculateFee(2_700, 250)   // → 67 (67.5 → 67)
```

**Test Coverage:** `fees.test.ts` tests specific cases; `fees.property.test.ts` verifies the formula across all inputs.

### 5. Monotonicity
**Property:** Fee increases with basis points or amount

For fixed amount: `bps₁ < bps₂ ⟹ fee(amount, bps₁) ≤ fee(amount, bps₂)`

For fixed bps: `amount₁ < amount₂ ⟹ fee(amount₁, bps) ≤ fee(amount₂, bps)`

**Why:** Intuitive: higher fees or larger amounts = higher absolute fee deducted.

**Test Coverage:** `fees.property.test.ts` verifies monotonicity across all valid inputs.

### 6. Integer Arithmetic
**Property:** All results are integers (no fractional stroops)

```typescript
const fee = calculateFee(amount, feeBps)
Number.isInteger(fee)  // Always true
```

**Why:** Stroops (smallest XLM unit) cannot be subdivided. All intermediate calculations must floor to integer stroops.

**Test Coverage:** `fees.property.test.ts` verifies integer output for all valid inputs.

### 7. Finite Results (No Overflow/Underflow)
**Property:** All calculations produce finite results

```typescript
const fee = calculateFee(amount, feeBps)
Number.isFinite(fee)  // Always true
```

**Why:** JavaScript numbers can overflow to `Infinity` or produce `NaN`. This invariant ensures stable calculations even with large amounts.

**Test Coverage:** `fees.property.test.ts` tests with `MAX_SAFE_INTEGER` and large values.

## Basis Points Scale

```
BASIS_POINTS_SCALE = 10_000
```

- `1 bps = 0.01%`
- `100 bps = 1%`
- `250 bps = 2.5%` (BlueCollar default)
- `500 bps = 5%` (BlueCollar maximum for API)
- `10_000 bps = 100%`

## Valid Ranges

| Parameter | Min | Max | Notes |
|-----------|-----|-----|-------|
| `amount` | 0 | MAX_SAFE_INTEGER | Non-negative stroops |
| `feeBps` | 0 | 10_000 | Basis points (100% max) |
| `fee` | 0 | amount | Calculated result |
| `net` | 0 | amount | Calculated result |

**API Layer Constraint:** The public API (`POST /payments/tip`) enforces `feeBps ≤ 500` (5% max) via Zod validation.

## Contract Alignment

This module mirrors the Rust contract implementations:

### TypeScript
```typescript
calculateFee(amount, bps) = Math.floor((amount * bps) / 10_000)
```

### Rust (`contracts/types/src/helpers.rs`)
```rust
fn split_fee(amount: i128, fee_bps: u32) -> (i128, i128) {
    let fee = amount * (fee_bps as i128) / 10_000;
    let net = amount - fee;
    (fee, net)
}

fn bps_share(amount: i128, bps: u32) -> Result<i128, ContractError> {
    let numerator = (amount as u128) * (bps as u128);
    let floored = numerator / 10_000;
    Ok(floored as i128)
}
```

**Why Important:** Fee calculations must match exactly. A 1-stroop difference would cause contract rejections.

## Usage Examples

### Calculate a fee
```typescript
import { calculateFee } from '@/domain/fees'

const amount = 10_000_000  // 1 XLM in stroops
const feeBps = 250         // 2.5%
const fee = calculateFee(amount, feeBps)
// → 25_000 stroops (0.0025 XLM)
```

### Split an amount into fee and net
```typescript
import { splitFee } from '@/domain/fees'

const [fee, net] = splitFee(10_000_000, 250)
// fee → 25_000
// net → 9_975_000
// fee + net → 10_000_000 ✓
```

### Distribute a share (per-recipient fees)
```typescript
import { bpsShare } from '@/domain/fees'

const totalFee = 25_000
const recipient1Weight = 6_000  // 60%
const recipient2Weight = 4_000  // 40%

const share1 = bpsShare(totalFee, recipient1Weight)  // → 15_000
const share2 = bpsShare(totalFee, recipient2Weight)  // → 10_000
```

### Validate basis points
```typescript
import { validateBasisPoints, isValidBasisPoints } from '@/domain/fees'

validateBasisPoints(250)  // ✓ no throw
validateBasisPoints(10_001)  // ✗ throws RangeError

isValidBasisPoints(250)  // → true
isValidBasisPoints('250')  // → false
```

## Error Handling

### Invalid Basis Points
Throws `RangeError` (which payment.service.ts converts to `AppError`):
```typescript
try {
  calculateFee(10_000, -1)
} catch (error) {
  // RangeError: Basis points must be an integer between 0 and 10000, got -1
}
```

### Service Layer Wrapping
The payment service catches `RangeError` and converts to domain-appropriate `AppError`:
```typescript
// In payment.service.ts
export function calculateFee(amount: number, fee_bps: number): number {
  try {
    return domainCalculateFee(amount, fee_bps)
  } catch (error) {
    if (error instanceof RangeError) {
      throw new AppError(
        'fee_bps must be between 0 and 10000',
        400,
        true,
        ErrorCode.VALIDATION_ERROR
      )
    }
    throw error
  }
}
```

## Testing Strategy

### Unit Tests (`fees.test.ts`)
- Basic calculations (2.5%, 5%, 1%, 0%, 100%)
- Rounding behavior (floor on fractional stroops)
- Edge cases (0 amount, 1 amount, MAX_SAFE_INTEGER)
- Balance conservation across test cases
- Error cases (invalid bps)
- Invariant checks

### Property-Based Tests (`fees.property.test.ts`)
Verify mathematical properties hold for ALL valid input combinations:

1. **Balance Conservation** - Across all amounts and basis points
2. **Fee Bounds** - 0 ≤ fee ≤ amount (all inputs)
3. **Net Bounds** - 0 ≤ net ≤ amount (all inputs)
4. **Floor Rounding** - fee ≡ ⌊amount × bps / 10_000⌋ (all inputs)
5. **Monotonicity** - Fee increases with bps or amount
6. **Integer Arithmetic** - All results are integers
7. **Finite Results** - No NaN or Infinity (even with MAX_SAFE_INTEGER)

### Service Integration Tests
- Payment service tests in `payment.service.fee-calc.test.ts` verify the domain module integration
- E2E tests verify API layer respects fee calculations

## Migration from payment.service.ts

### Before
```typescript
// Fee logic inline in payment.service.ts
export function calculateFee(amount: number, fee_bps: number): number {
  if (fee_bps < 0 || fee_bps > 10_000) {
    throw new AppError('...')
  }
  return Math.floor((amount * fee_bps) / 10_000)
}
```

### After
```typescript
// payment.service.ts delegates to domain module
import { calculateFee as domainCalculateFee } from '@/domain/fees'

export function calculateFee(amount: number, fee_bps: number): number {
  try {
    return domainCalculateFee(amount, fee_bps)
  } catch (error) {
    if (error instanceof RangeError) {
      throw new AppError('fee_bps must be between 0 and 10000', 400, ...)
    }
    throw error
  }
}
```

**Benefits:**
- ✓ Pure functions in domain module
- ✓ Reusable in other services
- ✓ Shared with contract expectations
- ✓ Comprehensive test coverage
- ✓ Clear invariant documentation

## Related Issues

- **#1640** - Move fee calculation into a domain module (this)
- **#1590** - Rounding consistency across contracts (canonical split_fee)
- **#1050** - Previous notification system refactor (adapter pattern reference)

## References

- `packages/api/src/domain/fees.ts` - Pure functions and validation
- `packages/api/src/domain/fees.test.ts` - Unit tests
- `packages/api/src/domain/fees.property.test.ts` - Property-based tests
- `packages/api/src/services/payment.service.ts` - Service layer integration
- `packages/contracts/contracts/types/src/helpers.rs` - Rust canonical implementation
