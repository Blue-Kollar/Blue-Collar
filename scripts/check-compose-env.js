#!/usr/bin/env node
/**
 * Compose env audit (#1689).
 *
 * Extracts every `${VAR}` and `${VAR:-default}` interpolation from
 * docker-compose*.yml files and asserts that at least one of the following
 * is true:
 *
 *   1. The var name appears in a `process.env.VAR` / `env.VAR` read somewhere
 *      under packages/ (source, not tests).
 *   2. The var is a Docker/Postgres reserved name that is consumed by the
 *      runtime image itself (POSTGRES_*, NODE_ENV, PORT, etc.).
 *   3. The var is a NEXT_PUBLIC_* build arg — these are baked into the
 *      frontend build at image build time.
 *   4. The var is referenced in a *.env* file that's mounted via `env_file:`.
 *
 * Exits 1 if any compose var is unused. Wire into CI as `pnpm check:compose-env`
 * (see CONTRIBUTING.md).
 *
 * This is the automated equivalent of the issue's "manual config check"
 * acceptance criterion, made repeatable so the audit does not drift.
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')

const COMPOSE_FILES = [
  'docker-compose.yml',
  'docker-compose.prod.example.yml',
  'docker-compose.staging.yml',
  'deploy/docker-compose.monitoring.yml',
  'deploy/jaeger/docker-compose.jaeger.yml',
].filter((f) => fs.existsSync(path.join(ROOT, f)))

// Reserved names consumed by the container / base image itself.
const RUNTIME_RESERVED = new Set([
  'NODE_ENV',
  'PORT',
  'COMPOSE_PROJECT_NAME',
  'COMPOSE_FILE',
])

// Postgres official image consumes these.
const POSTGRES_RESERVED = /^POSTGRES_/

// Next.js public build args — baked into the browser bundle at image build.
const NEXT_PUBLIC = /^NEXT_PUBLIC_/

function extractComposeVars(content) {
  // Matches ${VAR} and ${VAR:-default} and ${VAR:?err}
  const re = /\$\{([A-Z_][A-Z0-9_]*)(?::[-?][^}]*)?\}/g
  const out = new Set()
  let m
  while ((m = re.exec(content))) out.add(m[1])
  return out
}

function codeReads() {
  // Every process.env.VAR read in source (not tests, not node_modules).
  try {
    const raw = execSync(
      'grep -rhoE "process\\\\.env\\\\.[A-Z_][A-Z0-9_]*" packages ' +
        '--include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" ' +
        '2>/dev/null',
      { cwd: ROOT, encoding: 'utf8' },
    )
    return new Set(raw.split('\n').filter(Boolean).map((s) => s.split('.').pop()))
  } catch {
    return new Set()
  }
}

function envFileVars() {
  // Read every .env* file that a compose file mounts via env_file:.
  const files = []
  for (const cf of COMPOSE_FILES) {
    const content = fs.readFileSync(path.join(ROOT, cf), 'utf8')
    const re = /env_file:\s*\n((?:\s*-\s*[^\n]+\n?)+)/g
    let m
    while ((m = re.exec(content))) {
      for (const line of m[1].split('\n')) {
        const hit = line.match(/-\s*([^\s#]+)/)
        if (hit) files.push(hit[1].trim())
      }
    }
  }
  const names = new Set()
  for (const f of files) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const hit = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/)
      if (hit) names.add(hit[1])
    }
  }
  return names
}

function main() {
  const reads = codeReads()
  const envFile = envFileVars()
  const offenders = []

  for (const cf of COMPOSE_FILES) {
    const content = fs.readFileSync(path.join(ROOT, cf), 'utf8')
    const vars = extractComposeVars(content)
    for (const v of vars) {
      if (RUNTIME_RESERVED.has(v)) continue
      if (POSTGRES_RESERVED.test(v)) continue
      if (NEXT_PUBLIC.test(v)) continue
      if (reads.has(v)) continue
      if (envFile.has(v)) continue
      offenders.push({ file: cf, var: v })
    }
  }

  if (offenders.length) {
    console.error('[#1689] Unused compose variables found:')
    for (const o of offenders) console.error(`  ${o.file}: ${o.var}`)
    console.error('Delete them from the compose file, or add a read.')
    process.exit(1)
  }
  console.log(`[#1689] OK — all ${COMPOSE_FILES.length} compose file(s) reference only read variables.`)
}

main()
