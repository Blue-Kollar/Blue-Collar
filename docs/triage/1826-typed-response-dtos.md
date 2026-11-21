# Triage: typed API response DTOs (#1826)

## Checked

- A search of `packages/api/src` for DTO type names found no matches.
- Controllers return plain objects through `res.json(...)`, for example `src/controllers/webhooks.ts`.

## Not changed

No code change was made. Adding DTO types means touching every controller and its tests, which is a separate change.
