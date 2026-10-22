#!/usr/bin/env node
/**
 * Enforces naming conventions for component and hook files.
 *
 * Rules:
 *  - src/components/**  (excluding src/components/ui/) →  PascalCase
 *  - src/hooks/**                                      →  camelCase  (hooks start with lowercase)
 *
 * Exempt patterns:
 *  - *.stories.tsx / *.stories.ts  (Storybook)
 *  - *.test.tsx / *.test.ts        (Vitest)
 *  - index.ts / index.tsx          (barrel files)
 *  - src/components/ui/**          (shadcn/ui convention: kebab-case)
 *
 * Exit 1 if any violations are found so it can be wired into CI.
 */

import { readdirSync, statSync } from "fs";
import { join, relative, basename, extname } from "path";

const ROOT = new URL("../src", import.meta.url).pathname;

const PASCAL = /^[A-Z][A-Za-z0-9]*(\.[a-z]+)*\.(ts|tsx)$/;
const CAMEL  = /^[a-z][A-Za-z0-9]*(\.[a-z]+)*\.(ts|tsx)$/;

const EXEMPT_BASENAMES = new Set(["index.ts", "index.tsx"]);
const EXEMPT_MIDDLE_EXTS = [".stories.", ".test."];

function isExempt(filename) {
  if (EXEMPT_BASENAMES.has(filename)) return true;
  return EXEMPT_MIDDLE_EXTS.some((ext) => filename.includes(ext));
}

function walk(dir, cb) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, cb);
    } else {
      cb(full);
    }
  }
}

let violations = 0;

// ── components (excluding ui/) ────────────────────────────────────────────────
walk(join(ROOT, "components"), (fullPath) => {
  const rel = relative(ROOT, fullPath);
  // Skip shadcn/ui files (intentionally kebab-case)
  if (rel.startsWith("components/ui/")) return;

  const name = basename(fullPath);
  if (isExempt(name)) return;
  if (![".ts", ".tsx"].includes(extname(name))) return;

  if (!PASCAL.test(name)) {
    console.error(`[naming] PASCAL_CASE required: ${rel}`);
    violations++;
  }
});

// ── hooks ─────────────────────────────────────────────────────────────────────
walk(join(ROOT, "hooks"), (fullPath) => {
  const rel = relative(ROOT, fullPath);
  const name = basename(fullPath);
  if (isExempt(name)) return;
  if (![".ts", ".tsx"].includes(extname(name))) return;
  // Markdown docs inside hooks/ are exempt
  if (name.endsWith(".md")) return;

  if (!CAMEL.test(name)) {
    console.error(`[naming] camelCase required: ${rel}`);
    violations++;
  }
});

if (violations > 0) {
  console.error(`\n${violations} naming violation(s) found.`);
  process.exit(1);
} else {
  console.log("File naming conventions OK.");
}
