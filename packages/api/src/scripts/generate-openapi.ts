import { writeFileSync } from 'node:fs'
import { dirname,join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSpec } from '../openapi/spec.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', '..', 'openapi.json')
writeFileSync(out, JSON.stringify(buildSpec(), null, 2) + '\n')
console.log(`openapi.json written to ${out}`)
