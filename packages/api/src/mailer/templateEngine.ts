import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { escapeHtml } from '@/utils/sanitize.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Slots rendered from code-generated markup rather than raw user input.
const RAW_HTML_SLOTS = new Set(['extraHtml'])

export function render(templateName: string, vars: Record<string, string>): string {
  let html = readFileSync(join(__dirname, 'templates', templateName), 'utf-8')
  for (const [key, value] of Object.entries(vars)) {
    const inserted = RAW_HTML_SLOTS.has(key) ? value : escapeHtml(value)
    html = html.replaceAll(`{{${key}}}`, inserted)
  }
  return html
}
