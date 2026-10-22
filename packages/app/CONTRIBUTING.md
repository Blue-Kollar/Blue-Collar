# Contributing to BlueCollar App

Thanks for your interest in contributing to the BlueCollar frontend!

## Setup

```bash
git clone https://github.com/your-org/bluecollar.git
cd bluecollar
pnpm install

cp packages/app/.env.example packages/app/.env
# fill in NEXT_PUBLIC_API_URL

cd packages/app
pnpm dev   # starts on :3001
```

**Requirements:** Node.js >= 20, pnpm >= 9

## Code Style

- **ESLint** — `pnpm lint` (extends `next/core-web-vitals` + `next/typescript`)
- **TypeScript** — strict mode; run `pnpm type-check` before pushing
- No Prettier config yet — match the surrounding code style (2-space indent, double quotes)

## Component Conventions

- One component per file, named to match the filename (`WorkerCard.tsx` → `export default function WorkerCard`)
- Shared UI primitives live in `src/components/ui/` (shadcn/ui pattern)
- Feature-specific components live in `src/features/<feature-name>/`
- Page-level components live in `src/app/` following Next.js App Router conventions
- Use Tailwind utility classes; avoid inline styles

## State Management

The app package standardizes on **React Context + a paired `useX` hook** for any state that's shared across more than one component (auth session, wallet connection, comparison list, notifications). Local, single-component state should just use `useState`/`useReducer` — don't reach for Context until something outside the component actually needs it.

- Each piece of shared state lives in `src/context/<Name>Context.tsx` and exports two things: an `<XProvider>` and a `useX()` hook that wraps `useContext` internally. Components should never call `useContext` directly — always go through the exported hook.
- Providers are mounted once, near the root, in `src/app/layout.tsx` / `src/app/[locale]/layout.tsx`.
- `src/hooks/` may contain a same-named re-export (e.g. `useAuth`, `useWallet`) for backwards compatibility with older import paths — these just forward to the canonical context and shouldn't hold their own state. New code should import the hook directly from `@/context/<Name>Context`.
- Don't create a second, independent hook that re-implements state already owned by a context (this previously happened with wallet connection state and caused the navbar to fall out of sync with the rest of the app — see `src/context/WalletContext.tsx`).
- No external state library (Redux/Zustand/Jotai/etc.) is in use — keep it to Context + hooks unless a future need (e.g. large normalized client-side caches) genuinely outgrows it, and raise that as its own discussion first.

## Design

Figma design file: [BlueCollar UI Kit](https://www.figma.com/file/bluecollar-ui) *(request access from a maintainer)*

## Testing

### Unit & Component Tests

```bash
pnpm test              # run all tests
pnpm test:a11y         # run accessibility tests only
```

### E2E Tests

```bash
pnpm test:e2e          # run Playwright tests
pnpm test:e2e:ui       # run with interactive UI
```

### Accessibility Testing

Accessibility tests run automatically on every page using [axe-core](https://github.com/dequelabs/axe-core). Tests fail on **critical** or **serious** violations.

**To run locally:**
```bash
pnpm dev               # start the app
pnpm test:e2e          # in another terminal
```

**Accessibility reports** are generated in `a11y-reports/` and included as CI artifacts. Review these to understand any violations found.

**Common violations to fix:**
- Missing `alt` text on images
- Insufficient color contrast
- Missing form labels
- Improper heading hierarchy
- Missing ARIA attributes

See [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) for details.

### Visual Regression Testing

Visual tests catch unintended UI changes using Playwright snapshots and Percy.

**To update snapshots after intentional UI changes:**
```bash
pnpm test:e2e visual.spec.ts --update-snapshots
```

**To run visual tests:**
```bash
pnpm test:e2e visual.spec.ts
```

See [VISUAL_TESTING.md](./VISUAL_TESTING.md) for Percy setup and CI integration.

## PR Process

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes and ensure checks pass:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm build
   pnpm test
   pnpm test:e2e
   ```
3. Open a pull request against `main` with a clear description
4. All PRs require passing CI checks before merge

## Questions?

Open an issue or start a discussion on GitHub.

---

## Internationalisation (i18n)

The app uses [next-intl](https://next-intl-docs.vercel.app/) for translations. Locale files live in `src/messages/`.

### Supported locales

| Code | Language   |
|------|------------|
| `en` | English    |
| `fr` | Français   |
| `es` | Español    |
| `pt` | Português  |

### Adding a new locale

1. Create `src/messages/<code>.json` by copying `en.json` as a template.
2. Translate every value (keep the keys identical to `en.json`).
3. Add the locale code to the `locales` array in `src/middleware.ts`.
4. Add the language to the `languages` array in `src/components/LanguageSwitcher.tsx`.

### Adding new strings

1. Add the key/value to `src/messages/en.json` first.
2. Add the same key to every other locale file (`fr.json`, `es.json`, `pt.json`, …).
3. Use `useTranslations` in client components or `getTranslations` in server components:

```tsx
// Client component
import { useTranslations } from 'next-intl';
const t = useTranslations('common');
return <span>{t('save')}</span>;

// Server component
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('workers');
return <h1>{t('title')}</h1>;
```

### Locale detection

The middleware (`src/middleware.ts`) reads the `Accept-Language` header and redirects to the best-matching locale prefix (e.g. `/pt/workers`). The default locale is `en`.
