# Type Suppressions in `@bluecollar/sdk`

The SDK is consumed by both the frontend and mobile. A type suppression
here hides a type error from every consumer, so we hold suppressions to a
higher bar than in app code.

## Rules

1. **Never use `@ts-ignore`.** It silently swallows errors even after the
   underlying issue is fixed upstream.
2. **Use `@ts-expect-error - <reason>`** with a concrete reason. If the
   upstream issue is a library type gap, link to the tracking issue.
3. **Fix it when you can.** Most suppressions come from:
   - nullable values missing a `??` fallback
   - wrong generics that can be narrowed with `as unknown as T`
   - third-party overloads that can be cast through `unknown`

## Examples

### ❌ Wrong

```ts
// @ts-ignore
const tx = sdk.build(args);
const tx = sdk.build(args as BuildArgs) as unknown as Transaction;
// soroban-sdk@0.9 response type does not declare `.result`. Tracked at
// https://github.com/stellar/soroban-sdk/issues/XXXX
// @ts-expect-error - soroban-sdk@0.9.x response type missing `.result`
const result = response.result;
