## Summary

<!-- Briefly describe what this PR does and why. -->

## Related Issue

<!-- Link to the issue this PR addresses using "Closes #123". -->

Closes #1440
Closes #1439
Closes #1438
Closes #1437

## Type of Change

<!-- Check the box that applies. -->

- [ ] feat — New feature
- [ ] fix — Bug fix
- [ ] docs — Documentation
- [ ] refactor — Code restructuring (no functional change)
- [ ] test — Adding or updating tests
- [ ] chore — Build, deps, tooling
- [ ] i18n — Translations / localization
- [ ] Breaking change (include `!` in commit title)

## Checklist

<!-- Verify that you've done the following before requesting review. -->

### General

- [ ] PR title follows [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Changes are limited to a single scope (commit at a time)
- [ ] Branch is up to date with `main`

### Code Quality

- [ ] Linter passes (`pnpm lint`)
- [ ] Type checks pass (`pnpm type-check` or `pnpm build`)
- [ ] Tests pass (`pnpm test -- --run`)
- [ ] No new warnings introduced

### API (if applicable)

- [ ] Prisma migrations are included or not needed
- [ ] Destructive migrations are labelled `migration:destructive`

### Contracts (if applicable)

- [ ] `make clippy` passes with zero warnings
- [ ] `make fmt` has been run
- [ ] All contract tests pass (`make test`)

### App / Frontend (if applicable)

- [ ] Component tests pass
- [ ] No accessibility violations introduced

### Documentation (if applicable)

- [ ] Related docs are updated (README, docs/, JSDoc)
- [ ] Translation files are in sync with `en.json`

## Screenshots (if applicable)

<!-- Add screenshots to help reviewers understand visual changes. -->

## Additional Notes

<!-- Anything reviewers should know: testing instructions, edge cases, follow-up work. -->
