# BlueCollar Integration Tests - Canonical Lifecycle Reference

This document describes the comprehensive integration tests that serve as the definitive reference for BlueCollar contract interactions and job lifecycles. These tests validate the complete end-to-end functionality across all contract components.

## Overview

The integration tests cover two primary workflows:
1. **Happy Path Lifecycle** - Successful job completion with payment and reputation update
2. **Dispute Path Lifecycle** - Job completion with dispute resolution and arbitration

These tests exercise the full spectrum of contract interactions and serve as:
- **Integration verification** - Ensuring all contracts work together correctly
- **Workflow documentation** - Canonical reference for expected behavior
- **Regression testing** - Preventing changes that break contract interactions
- **Development examples** - Reference implementations for client integrations

## Test Files

### `job_lifecycle_happy_path.rs`
**Purpose**: Tests the complete successful job lifecycle from posting to completion.

**Flow**:
```
1. Worker Registration (Registry Contract)
   ├── Admin sets up curator roles
   ├── Curator registers worker with profile
   └── Worker status verified as active

2. Job Posting & Escrow (Escrow Contract)
   ├── Client creates escrow with job payment
   ├── Funds locked in escrow contract
   └── Escrow details verified

3. Payment Processing (Market Contract)
   ├── Payment processed with protocol fee deduction
   ├── Worker receives payment minus fee
   └── Fee recipient receives protocol fee

4. Reputation Update (Reputation Contract)
   ├── Rating role granted to client
   ├── Positive rating submitted for worker
   └── Worker reputation stats updated
```

**Key Validations**:
- ✅ Worker registration and profile verification
- ✅ Escrow creation and fund locking
- ✅ Fee calculation and distribution (2.5% protocol fee)
- ✅ Token balance verification at each step
- ✅ Reputation system integration
- ✅ End-to-end payment flow integrity

### `job_lifecycle_dispute_path.rs`
**Purpose**: Tests the complete dispute resolution lifecycle including arbitration.

**Flow**:
```
1. Initial Setup (Multiple Contracts)
   ├── Worker registered in registry
   ├── Arbitrator added to dispute system
   └── Job funds escrowed

2. Dispute Filing (Dispute Contract)
   ├── Client files dispute with evidence
   ├── Arbitration fee locked
   └── Dispute status set to "Open"

3. Evidence Phase (Dispute Contract)
   ├── Worker submits counter-evidence
   ├── Additional evidence from client
   └── Evidence collection verified

4. Arbitration Decision (Dispute Contract)
   ├── Arbitrator reviews evidence
   ├── Decision recorded (70/30 split example)
   └── Dispute status updated to "Decided"

5. Settlement Execution (Dispute Contract)
   ├── Arbitration decision executed
   ├── Fees distributed per decision
   └── Dispute marked as "Settled"

6. Reputation Impact (Reputation Contract)
   ├── Dispute outcome affects rating
   ├── Worker receives reduced rating
   └── Reputation statistics updated
```

**Key Validations**:
- ✅ Dispute filing with evidence submission
- ✅ Multi-party evidence collection
- ✅ Arbitrator decision process
- ✅ Fee distribution based on arbitration outcome
- ✅ Reputation impact from dispute resolution
- ✅ Complete dispute lifecycle state management

## Contract Dependencies

The integration tests validate interactions between:

| Contract | Role | Functions Tested |
|----------|------|------------------|
| **Registry** | Worker Management | `register`, `add_curator`, `get_worker` |
| **Market** | Payment Processing | `tip`, `initialize`, fee calculation |
| **Escrow** | Fund Management | `create_escrow`, `cancel_escrow`, `get_escrow` |
| **Dispute** | Conflict Resolution | `file_dispute`, `submit_evidence`, `decide`, `execute` |
| **Reputation** | Rating System | `add_rating`, `get_worker_stats`, role management |

## Test Scenarios Covered

### Happy Path Scenarios
1. **Standard Job Completion** - Worker completes job, receives payment and positive rating
2. **Escrow Expiry** - Client can cancel expired escrow and recover funds

### Dispute Path Scenarios
1. **Client-Favored Resolution** - Client wins dispute with 70/30 split
2. **Worker-Favored Resolution** - Worker vindicated with 90/10 split in their favor
3. **Timeout Handling** - Disputes that remain unresolved (pending arbitration)

## Running the Tests

```bash
# Run all integration tests
cd packages/contracts
cargo test --package bluecollar-integration

# Run specific lifecycle tests
cargo test --package bluecollar-integration job_lifecycle_happy_path
cargo test --package bluecollar-integration job_lifecycle_dispute_path

# Run with output for debugging
cargo test --package bluecollar-integration -- --nocapture
```

## Test Environment

- **Network**: Soroban testutils (in-process testnet simulation)
- **Tokens**: Mock Stellar asset contracts
- **Accounts**: Generated test addresses with mock authentication
- **State**: Fresh contract deployments for each test
- **Time**: Controllable ledger sequence for testing time-based logic

## Expected Outcomes

### Happy Path Results
- Worker receives: 9,750 tokens (10,000 - 2.5% fee)
- Protocol fee: 250 tokens 
- Worker rating: 5/5 stars
- All contract states consistent

### Dispute Path Results
- Dispute resolution: 70% to client, 30% to worker (example)
- Worker rating: 2/5 stars (due to dispute)
- All dispute lifecycle states properly transitioned
- Arbitration fees distributed correctly

## Development Notes

### Known Compilation Issues (To Fix)
1. **Lifetime Annotations**: Setup functions need proper lifetime specifications
2. **Parameter Types**: Some contract initialization parameters need reference types
3. **Enum Variants**: Dispute outcome and status enums need correct variant names
4. **Return Types**: Some initialization methods return `()` instead of `Result<(), Error>`

### Future Enhancements
1. **Multi-milestone Jobs**: Tests for complex job structures
2. **Batch Operations**: Multiple job processing scenarios
3. **Edge Cases**: Network failures, invalid inputs, boundary conditions
4. **Performance Tests**: Large-scale transaction processing
5. **Security Tests**: Authorization bypass attempts, reentrancy scenarios

## Integration with CI/CD

These integration tests should be:
- ✅ Run automatically on all contract changes
- ✅ Required to pass before merging PRs
- ✅ Executed on multiple Soroban versions
- ✅ Performance monitored for regression detection
- ✅ Extended when new contracts or features are added

## Conclusion

The integration tests in this directory serve as the **single source of truth** for BlueCollar contract interactions. They document expected behavior, validate cross-contract functionality, and ensure system reliability.

Any changes to contract interfaces or business logic should be reflected in these tests first, following a test-driven development approach for critical protocol functionality.