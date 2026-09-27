/**
 * Email template preview — Issue #1353
 *
 * Renders every template under mailer/templates/ with representative sample
 * data and prints the result (or failure) for each. Run with:
 *   tsx src/scripts/preview-email-templates.ts
 */
import { render } from '../mailer/templateEngine.js'

const SAMPLE_VARS: Record<string, Record<string, string>> = {
  'verify-email.html': { name: 'Jordan', verificationLink: 'https://bluecollar.app/verify?token=sample' },
  'verification-reminder.html': {
    name: 'Jordan',
    verificationLink: 'https://bluecollar.app/verify?token=sample',
    unsubscribeLink: 'https://bluecollar.app/unsubscribe?token=sample',
  },
  'reset-password.html': { name: 'Jordan', resetLink: 'https://bluecollar.app/reset-password?token=sample' },
  'welcome.html': { name: 'Jordan', appUrl: 'https://bluecollar.app' },
  'notification.html': {
    subject: 'Sample notification',
    name: 'Jordan',
    message: 'This is a sample notification body.',
    extraHtml: '',
    ctaText: 'View dashboard',
    ctaLink: 'https://bluecollar.app/dashboard',
  },
}

function main(): void {
  const results: { template: string; ok: boolean; error?: string }[] = []

  for (const [template, vars] of Object.entries(SAMPLE_VARS)) {
    try {
      const html = render(template, vars)
      const unresolved = html.match(/{{\s*[\w]+\s*}}/g)
      if (unresolved) {
        results.push({ template, ok: false, error: `unresolved placeholders: ${unresolved.join(', ')}` })
      } else {
        results.push({ template, ok: true })
      }
    } catch (err) {
      results.push({ template, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  for (const result of results) {
    console.log(result.ok ? `✔ ${result.template} rendered cleanly` : `✘ ${result.template} — ${result.error}`)
  }

  if (results.some((r) => !r.ok)) {
    process.exitCode = 1
  }
}

main()
