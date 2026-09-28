# Issue 3 — Relocate generic `helpers/` utilities into domain modules

## Audit

`packages/api/src/helpers/` contained exactly one file,
`notificationPrefs.ts`, with two functions: `seedDefaultPreferences` and
`isNotificationEnabled`. Both are notification-preferences domain logic
(read/write `db.notificationPreferences`), not generic utilities — the
`helpers/` bucket had no clear ownership boundary and only ever held this
one unrelated-by-name file.

Other `helpers/` directories in the repo
(`packages/app/e2e/helpers`, `packages/api/src/__tests__/helpers`) are
test-fixture helper directories, not the generic app-code grab-bag this
issue targets, and were left as-is.

## What changed

- Moved `helpers/notificationPrefs.ts` to
  `services/notificationPreferences.service.ts`, alongside the existing
  `services/notification.service.ts` it's conceptually paired with
  (delivery vs. preferences for the same notifications domain).
- Updated the one import site,
  `__tests__/notificationPrefs.test.ts`, to the new path.
- Removed the now-empty `packages/api/src/helpers/` directory.

## Result

`packages/api/src/helpers/` no longer exists — there's nothing left to
document a "narrow remaining purpose" for.
