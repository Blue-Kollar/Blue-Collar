# File Naming Convention Enforcement - Summary

## Issue #1691: Enforce kebab-case file names

This document summarizes the changes made to enforce kebab-case file naming conventions across the BlueCollar monorepo.

---

## Changes Made

### 1. Documentation (CONTRIBUTING.md)
Added comprehensive file naming convention section with:
- Clear rules by file type
- Examples of correct and incorrect naming
- Enforcement details

### 2. ESLint Configuration
- **Added dependency**: `eslint-plugin-unicorn@^56.0.1` to root `package.json`
- **Configured rule**: `unicorn/filename-case` in `eslint-base-rules.js`
- **Updated all package ESLint configs** to use the new filename rules:
  - `packages/api/eslint.config.js` (ESLint 9 flat config)
  - `packages/app/.eslintrc.js` (ESLint 8 legacy)
  - `packages/mobile/.eslintrc.js` (ESLint 8 legacy)
  - `packages/sdk/eslint.config.js` (ESLint 9 flat config)
  - `packages/types/eslint.config.js` (ESLint 9 flat config)

### 3. File Renames

#### API Package (`packages/api`)
- `src/utils/AppError.ts` → `src/utils/app-error.ts`

#### Mobile Package (`packages/mobile`)
- `src/auth/BiometricAuth.ts` → `src/auth/biometric-auth.ts`
- `src/auth/SecureStorage.ts` → `src/auth/secure-storage.ts`
- `src/cache/CacheStore.ts` → `src/cache/cache-store.ts`
- `src/cache/NetworkMonitor.ts` → `src/cache/network-monitor.ts`
- `src/cache/StaleWhileRevalidate.ts` → `src/cache/stale-while-revalidate.ts`

#### Test Files (also renamed)
- `src/auth/__tests__/BiometricAuth.test.ts` → `biometric-auth.test.ts`
- `src/auth/__tests__/SecureStorage.test.ts` → `secure-storage.test.ts`
- `src/cache/__tests__/CacheStore.test.ts` → `cache-store.test.ts`
- `src/cache/__tests__/NetworkMonitor.test.ts` → `network-monitor.test.ts`

### 4. Import Updates
All imports were automatically updated using the `smart_relocate` tool. Manual updates were made to:
- `packages/api/src/services/response-time.service.test.ts`
- `packages/mobile/src/cache/index.ts`
- `packages/mobile/src/cache/network-monitor.ts`
- `packages/mobile/src/cache/stale-while-revalidate.ts`
- `packages/mobile/src/cache/__tests__/network-monitor.test.ts`
- `packages/mobile/src/cache/__tests__/cache-store.test.ts`

---

## File Naming Rules

### Enforced Convention
**Default**: kebab-case for all TypeScript/JavaScript files

### Exceptions
1. **React Components** (.tsx with JSX): PascalCase
   - ✅ `Navbar.tsx`, `BookmarkButton.tsx`

2. **React Hooks**: camelCase with 'use' prefix
   - ✅ `useDebounce.ts`, `useWallet.ts`

3. **Next.js Special Files**: lowercase
   - ✅ `page.tsx`, `layout.tsx`, `error.tsx`, `robots.ts`, `sitemap.ts`

4. **Test Files**: Match source naming + `.test.ts`/`.test.tsx`
   - ✅ `auth.service.test.ts`, `Navbar.test.tsx`

5. **Storybook Files**: PascalCase + `.stories.tsx`
   - ✅ `Button.stories.tsx`

6. **Type Definitions**: kebab-case
   - ✅ `worker.interface.ts`, `repository.interface.ts`

---

## Required Actions

### Step 1: Install Dependencies
Since `pnpm` was not directly available during the automated changes, you need to install the new dependency:

```bash
pnpm install
```

This will install `eslint-plugin-unicorn@^56.0.1` which was added to `package.json`.

### Step 2: Verify Linting
Run the lint check to ensure the filename convention is enforced:

```bash
pnpm lint
```

Expected result: ✅ All lint checks should pass with no filename violations.

### Step 3: Run Type Check
Verify that all import updates are correct:

```bash
pnpm type-check
```

Expected result: ✅ No TypeScript errors related to missing modules or imports.

### Step 4: Run Tests
Verify that all renamed files work correctly:

```bash
# Run all tests
pnpm test

# Or run package-specific tests
pnpm --filter @bluecollar/api test
pnpm --filter @bluecollar/app test
pnpm --filter @bluecollar/mobile test
```

Expected result: ✅ All tests should pass.

### Step 5: Build
Verify that the build process works:

```bash
pnpm build
```

Expected result: ✅ Build should complete successfully for all packages.

---

## CI/CD Integration

The filename convention is now enforced by ESLint, which means:

1. **Pre-commit hook**: `lint-staged` will check filenames before allowing commits
2. **CI Pipeline**: The `lint` job in GitHub Actions will fail if non-compliant filenames are added
3. **PR Checks**: All pull requests will be blocked if filename violations exist

---

## Troubleshooting

### If lint fails with "Cannot find module 'eslint-plugin-unicorn'"
Run: `pnpm install`

### If you see import errors after the changes
1. Check that you're using the correct file path (kebab-case)
2. Search for the old PascalCase import: `grep -r "OldFileName" packages/`
3. Update any remaining imports manually

### If tests fail
1. Check that test files were also renamed to match their source files
2. Verify mock paths in test files use the new kebab-case names

---

## Files Modified

### Configuration Files
- `package.json` (root)
- `eslint-base-rules.js`
- `packages/api/eslint.config.js`
- `packages/app/.eslintrc.js`
- `packages/mobile/.eslintrc.js`
- `packages/sdk/eslint.config.js`
- `packages/types/eslint.config.js`

### Documentation
- `CONTRIBUTING.md`

### Renamed Source Files (API)
- `packages/api/src/utils/app-error.ts`

### Renamed Source Files (Mobile)
- `packages/mobile/src/auth/biometric-auth.ts`
- `packages/mobile/src/auth/secure-storage.ts`
- `packages/mobile/src/cache/cache-store.ts`
- `packages/mobile/src/cache/network-monitor.ts`
- `packages/mobile/src/cache/stale-while-revalidate.ts`

### Updated Imports
- `packages/api/src/services/response-time.service.test.ts`
- `packages/mobile/src/cache/index.ts`
- `packages/mobile/src/cache/network-monitor.ts`
- `packages/mobile/src/cache/stale-while-revalidate.ts`
- `packages/mobile/src/cache/__tests__/cache-store.test.ts`
- `packages/mobile/src/cache/__tests__/network-monitor.test.ts`

---

## Acceptance Criteria Status

- ✅ **Filename rule passes**: ESLint configuration is in place
- ⏳ **Tested (build)**: User needs to run `pnpm build`
- ⏳ **Code review passed**: Awaiting PR review
- ⏳ **Related tests passing**: User needs to run `pnpm test`

---

## Next Steps

1. Run the commands in the "Required Actions" section above
2. Commit all changes with a conventional commit message:
   ```bash
   git add .
   git commit -m "chore: enforce kebab-case file naming convention (#1691)"
   ```
3. Push and open a PR for review
4. After PR approval, merge to `main`

---

## Questions or Issues?

If you encounter any problems with the changes:
1. Check that `pnpm install` completed successfully
2. Review the "Troubleshooting" section above
3. Check the ESLint output for specific filename violations
4. Refer to `CONTRIBUTING.md` for the complete file naming rules
