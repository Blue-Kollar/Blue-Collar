# Internationalization (i18n) & Translations Guide

This guide explains how BlueCollar handles internationalization using `next-intl`, how translation files are structured, and how to add new languages or contribute translations.

## next-intl Configuration

BlueCollar uses [next-intl](https://next-intl-docs.vercel.app) for all i18n functionality in the `packages/app` Next.js frontend.

### Plugin Setup

`packages/app/next.config.mjs` wraps the Next.js config with the `next-intl` plugin:

```javascript
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()
export default withNextIntl(nextConfig)
```

The plugin automatically picks up `packages/app/src/i18n.ts` as the request config entry point.

### Request Config

`packages/app/src/i18n.ts` loads the correct message file for each request based on the active locale:

```typescript
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}))
```

### Middleware

`packages/app/src/middleware.ts` handles locale detection and URL prefixing:

```typescript
import createMiddleware from 'next-intl/middleware'

const intlMiddleware = createMiddleware({
  locales: ['en', 'fr', 'es'],
  defaultLocale: 'en',
  localePrefix: 'always',   // All URLs include the locale prefix: /en/workers, /fr/workers
})
```

The `localePrefix: 'always'` strategy means every URL includes the locale segment. A request to `/workers` will redirect to `/en/workers`.

### URL Structure

```
/en/workers          → English workers page
/fr/workers          → French workers page
/es/dashboard        → Spanish dashboard
/en/auth/login       → English login page
```

## Translation File Structure

Translation files live in `packages/app/src/messages/` as JSON files, one per locale.

```
packages/app/src/messages/
├── en.json    # English (default)
├── es.json    # Spanish
└── fr.json    # French
```

### File Format

Each file is a flat or nested JSON object. BlueCollar uses a two-level namespace structure: a top-level namespace key followed by message keys.

```json
{
  "common": {
    "home": "Home",
    "save": "Save",
    "cancel": "Cancel"
  },
  "workers": {
    "title": "Find Skilled Workers",
    "noResults": "No workers found"
  },
  "auth": {
    "email": "Email",
    "loginTitle": "Login to BlueCollar"
  },
  "dashboard": {
    "title": "Dashboard",
    "myWorkers": "My Workers"
  }
}
```

### Current Namespaces

| Namespace   | Purpose                                      |
|-------------|----------------------------------------------|
| `common`    | Shared UI labels (nav, buttons, status words)|
| `workers`   | Workers listing and profile page strings     |
| `auth`      | Authentication forms and labels              |
| `dashboard` | Dashboard page strings                       |

### Using Translations in Components

In Server Components:

```typescript
import { getTranslations } from 'next-intl/server'

export default async function WorkersPage() {
  const t = await getTranslations('workers')
  return <h1>{t('title')}</h1>
}
```

In Client Components:

```typescript
'use client'
import { useTranslations } from 'next-intl'

export default function WorkerCard() {
  const t = useTranslations('workers')
  return <span>{t('verified')}</span>
}
```

## Adding a New Language

Follow these steps to add a new locale.

### 1. Create the translation file

Copy `en.json` as a starting point and translate all values. Keep all keys identical to the English file.

```bash
cp packages/app/src/messages/en.json packages/app/src/messages/pt.json
```

Then translate the values in `pt.json`:

```json
{
  "common": {
    "home": "Início",
    "save": "Salvar",
    "cancel": "Cancelar"
  },
  "workers": {
    "title": "Encontrar Trabalhadores Qualificados",
    "noResults": "Nenhum trabalhador encontrado"
  }
}
```

### 2. Register the locale in middleware

Add the new locale code to the `locales` array in `packages/app/src/middleware.ts`:

```typescript
const intlMiddleware = createMiddleware({
  locales: ['en', 'fr', 'es', 'pt'],  // add 'pt'
  defaultLocale: 'en',
  localePrefix: 'always',
})
```

### 3. Update the LanguageSwitcher component

`packages/app/src/components/LanguageSwitcher.tsx` renders the locale options. Add the new locale with its display name:

```typescript
const locales = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },  // add this
]
```

### 4. Verify the route structure

The `[locale]` dynamic segment in `packages/app/src/app/[locale]/` handles all localized routes automatically. No additional route changes are needed.

### 5. Test the new locale

Start the dev server and navigate to `http://localhost:3000/pt` to verify the new locale loads correctly.

## Translation Contribution Workflow

### For contributors adding or updating translations

1. Fork the repository and create a branch: `git checkout -b i18n/add-portuguese`
2. Add or update the translation file in `packages/app/src/messages/`
3. Ensure every key present in `en.json` also exists in your translation file — missing keys fall back to the key name, not the English value
4. Open a pull request with the title format: `i18n: add Portuguese (pt) translations`

### Keeping translations in sync

When new features add strings to `en.json`, all other locale files must be updated. A missing key will render the raw key string (e.g., `workers.newFeature`) in the UI.

To find missing keys, compare your locale file against `en.json`:

```bash
# Quick diff of top-level keys
node -e "
const en = require('./packages/app/src/messages/en.json')
const pt = require('./packages/app/src/messages/pt.json')
const missing = Object.keys(en).filter(k => !pt[k])
console.log('Missing namespaces:', missing)
"
```

## Pluralization and Formatting Rules

`next-intl` uses the [ICU message format](https://unicode-org.github.io/icu/userguide/format_parse/messages/) for pluralization and interpolation.

### Variable Interpolation

Pass dynamic values as the second argument to `t()`:

```json
{
  "workers": {
    "resultsCount": "Showing {count} workers"
  }
}
```

```typescript
t('resultsCount', { count: 42 })
// → "Showing 42 workers"
```

### Pluralization

Use ICU plural syntax to handle singular/plural forms:

```json
{
  "workers": {
    "reviewCount": "{count, plural, =0 {No reviews} one {# review} other {# reviews}}"
  }
}
```

```typescript
t('reviewCount', { count: 0 })   // → "No reviews"
t('reviewCount', { count: 1 })   // → "1 review"
t('reviewCount', { count: 5 })   // → "5 reviews"
```

Each locale file should provide the plural forms appropriate for that language. For example, Russian has more plural categories than English — consult the [CLDR plural rules](https://cldr.unicode.org/index/cldr-spec/plural-rules) for the target language.

### Date and Number Formatting

`next-intl` integrates with the Intl API for locale-aware formatting:

```typescript
import { useFormatter } from 'next-intl'

function PriceDisplay({ amount }: { amount: number }) {
  const format = useFormatter()
  return <span>{format.number(amount, { style: 'currency', currency: 'USD' })}</span>
}
```

```typescript
// Date formatting
format.dateTime(new Date(), { dateStyle: 'medium' })
// en: "Apr 23, 2026"
// fr: "23 avr. 2026"
// es: "23 abr 2026"
```

### Select (Gender / Conditional)

Use ICU `select` for gender-aware or conditional strings:

```json
{
  "workers": {
    "workerStatus": "{status, select, active {Available} inactive {Unavailable} other {Unknown}}"
  }
}
```
