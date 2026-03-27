# BlueCollar Soroban Contracts

Two contracts deployed on Stellar (Soroban): **Registry** and **Market**.

---

## Registry Contract

Manages worker registrations on-chain.

### Functions

| Function | Description |
|---|---|
| `register(id, owner, name, category)` | Register a new worker |
| `get_worker(id)` | Fetch a worker by id |
| `toggle(id, caller)` | Toggle active status (owner only) |
| `update(id, caller, name, category)` | Update name/category (owner only) |
| `deregister(id, caller)` | Remove a worker (owner only) |
| `list_workers()` | List all worker ids |

### Events

All events are published via `env.events().publish(topics, data)`.

#### WorkerRegistered

Emitted when a new worker is registered.

```
topics: (Symbol("WrkReg"), id: Symbol)
data:   (owner: Address, category: Symbol)
```

#### WorkerToggled

Emitted when a worker's active status is toggled.

```
topics: (Symbol("WrkTgl"), id: Symbol)
data:   is_active: bool
```

#### WorkerUpdated

Emitted when a worker's name or category is updated.

```
topics: (Symbol("WrkUpd"), id: Symbol)
data:   (name: String, category: Symbol)
```

#### WorkerDeregistered

Emitted when a worker is removed from the registry.

```
topics: (Symbol("WrkDrg"), id: Symbol)
data:   caller: Address
```

---

## Market Contract

Handles direct tips and escrow-based payments between users and workers.

### Functions

| Function | Description |
|---|---|
| `tip(from, to, token_addr, amount)` | Send a direct tip to a worker |
| `create_escrow(id, from, to, token_addr, amount)` | Lock funds in escrow |
| `release_escrow(id, caller)` | Release escrow to worker (payer only) |
| `cancel_escrow(id, caller)` | Refund escrow to payer (payer only) |
| `get_escrow(id)` | Fetch escrow details by id |

### Events

#### TipSent

Emitted when a direct tip is transferred.

```
topics: (Symbol("TipSent"), from: Address, to: Address)
data:   (token: Address, amount: i128)
```

#### EscrowCreated

Emitted when funds are locked in escrow.

```
topics: (Symbol("EscCrt"), id: Symbol, from: Address)
data:   (to: Address, token: Address, amount: i128)
```

#### EscrowReleased

Emitted when escrow funds are released to the worker.

```
topics: (Symbol("EscRel"), id: Symbol, to: Address)
data:   amount: i128
```

#### EscrowCancelled

Emitted when escrow is cancelled and funds are refunded.

```
topics: (Symbol("EscCnl"), id: Symbol, from: Address)
data:   amount: i128
```

---

## Notes

- All `Symbol` topic keys are ≤ 9 characters to satisfy Soroban's `symbol_short!` constraint.
- Topics are indexed and filterable by off-chain indexers (e.g. Horizon event streaming).
- Data fields are ABI-encoded via `contracttype` and decodable with the Stellar SDK.
