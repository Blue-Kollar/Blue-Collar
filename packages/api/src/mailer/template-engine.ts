import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function render(templateName: string, vars: Record<string, string>): string {
  let html = readFileSync(join(__dirname, 'templates', templateName), 'utf-8')
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, value)
  }
  return html
}
