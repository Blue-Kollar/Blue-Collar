# Email Templates Guide

This guide covers how the BlueCollar API sends transactional emails, how templates are structured, and how to add new email types.

## Template Structure

Templates live in `packages/api/src/mailer/templates/` as plain HTML files. The mailer module (`packages/api/src/mailer/index.ts`) loads them at runtime using `fs.readFileSync` and performs simple string replacement for dynamic values.

```
packages/api/src/mailer/
├── index.ts          # Email sending functions
├── transport.ts      # Nodemailer transporter config
└── templates/
    ├── verify-email.html
    ├── reset-password.html
    └── welcome.html
```

Each template is a self-contained HTML file with inline `<style>` blocks for maximum email client compatibility.

### Base Layout

All templates share the same layout pattern:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Title</title>
  <style>
    /* Inline styles — see Styling Best Practices below */
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>BlueCollar</h1></div>
    <div class="body">
      <!-- Email content here -->
    </div>
    <div class="footer">© BlueCollar · Find Skilled Workers Near You</div>
  </div>
</body>
</html>
```

## Available Template Variables

Variables use `{{variableName}}` syntax and are replaced via `.replace(/{{variableName}}/g, value)` in `index.ts`.

### verify-email.html

| Variable             | Description                                      |
|----------------------|--------------------------------------------------|
| `{{name}}`           | Recipient's first name                           |
| `{{verificationLink}}` | Full URL to verify the account (24-hour expiry) |

### reset-password.html

| Variable        | Description                                    |
|-----------------|------------------------------------------------|
| `{{name}}`      | Recipient's first name                         |
| `{{resetLink}}` | Full URL to reset the password (1-hour expiry) |

### welcome.html

| Variable     | Description                        |
|--------------|------------------------------------|
| `{{name}}`   | Recipient's first name             |
| `{{appUrl}}` | Base URL of the BlueCollar app     |

### Contact Request (inline template)

The contact request email in `sendContactRequestEmail` uses an inline HTML string rather than a file template. It receives `workerName` and `fromUserName` directly as function parameters.

## Adding a New Email Type

Follow these steps to add a new transactional email.

### 1. Create the HTML template

Add a new file to `packages/api/src/mailer/templates/`. Use the base layout above and add `{{placeholder}}` variables where dynamic content is needed.

```html
<!-- packages/api/src/mailer/templates/booking-confirmed.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Confirmed</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: Arial, sans-serif; color: #111827; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .header { background: #1d4ed8; padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; }
    .body { padding: 36px 40px; }
    .body p { margin: 0 0 16px; line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; margin: 8px 0 24px; padding: 12px 28px; background: #1d4ed8; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; }
    .footer { padding: 20px 40px; background: #f9fafb; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>BlueCollar</h1></div>
    <div class="body">
      <p>Hi {{name}},</p>
      <p>Your booking with <strong>{{workerName}}</strong> has been confirmed.</p>
      <a href="{{dashboardUrl}}" class="btn">View Booking</a>
    </div>
    <div class="footer">© BlueCollar · Find Skilled Workers Near You</div>
  </div>
</body>
</html>
```

### 2. Add the sending function to index.ts

```typescript
// packages/api/src/mailer/index.ts

export async function sendBookingConfirmedEmail(
  to: string,
  name: string,
  workerName: string
) {
  const html = loadTemplate('booking-confirmed.html')
    .replace(/{{name}}/g, name)
    .replace(/{{workerName}}/g, workerName)
    .replace(/{{dashboardUrl}}/g, `${APP_URL}/dashboard`)

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Your booking is confirmed',
    html,
  })
}
```

### 3. Call the function from your service or controller

```typescript
import { sendBookingConfirmedEmail } from '../mailer/index.js'

// Inside your service after creating a booking:
await sendBookingConfirmedEmail(user.email, user.firstName, worker.name)
```

## Styling Best Practices

Email clients have notoriously inconsistent CSS support. Follow these rules to keep templates rendering correctly everywhere.

- **Inline all styles** — use a `<style>` block in `<head>` as a fallback, but prefer inline `style=""` attributes for critical layout properties. Many clients (Gmail, Outlook) strip `<head>` styles.
- **Use `max-width` on the wrapper** — set `max-width: 560px` and `margin: auto` so the email looks good on both desktop and mobile.
- **Avoid `flexbox` and `grid`** — use `display: block` and `table`-based layouts for Outlook compatibility.
- **Use web-safe fonts** — `Arial`, `Helvetica`, `Georgia`, `Times New Roman`. Custom fonts via `@font-face` are not supported in most clients.
- **Use `!important` on link colors** — many clients override `<a>` colors. Add `color: #ffffff !important` to button links.
- **Keep images optional** — many clients block images by default. Never rely on an image to convey critical information.
- **Test with real pixel values** — avoid `em`/`rem` units; use `px` for font sizes, padding, and margins.
- **Always include a plain-text fallback** — add a `text` field alongside `html` in `sendMail` options for clients that don't render HTML.

```typescript
await transporter.sendMail({
  from: FROM,
  to,
  subject: 'Your booking is confirmed',
  html,
  text: `Hi ${name}, your booking with ${workerName} is confirmed. Visit ${APP_URL}/dashboard`,
})
```

## Testing Email Templates Locally

### Option 1: Mailpit (recommended)

[Mailpit](https://github.com/axllent/mailpit) is a local SMTP server with a web UI that catches all outgoing emails without sending them.

```bash
# Install via Docker
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
```

Set these values in `packages/api/.env`:

```env
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USER=test
MAIL_PASS=test
```

Open `http://localhost:8025` to view captured emails.

### Option 2: Ethereal Email

[Ethereal](https://ethereal.email) is a free fake SMTP service. Create a test account and use the provided credentials in `.env`. Sent emails are viewable in the Ethereal web UI.

### Option 3: Write a unit test

Mock the transporter and assert the correct template variables are substituted:

```typescript
import { vi, describe, it, expect } from 'vitest'

vi.mock('../mailer/transport.js', () => ({
  transporter: {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
  },
}))

import { transporter } from '../mailer/transport.js'
import { sendBookingConfirmedEmail } from '../mailer/index.js'

describe('sendBookingConfirmedEmail', () => {
  it('sends email with correct subject and substituted variables', async () => {
    await sendBookingConfirmedEmail('user@example.com', 'Alice', 'Bob the Plumber')

    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Your booking is confirmed',
        html: expect.stringContaining('Bob the Plumber'),
      })
    )
  })
})
```

Run the test with:

```bash
cd packages/api
pnpm test --run
```
