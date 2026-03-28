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

## Design

Figma design file: [BlueCollar UI Kit](https://www.figma.com/file/bluecollar-ui) *(request access from a maintainer)*

## PR Process

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes and ensure checks pass:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm build
   ```
3. Open a pull request against `main` with a clear description
4. All PRs require passing CI checks before merge

## Questions?

Open an issue or start a discussion on GitHub.
