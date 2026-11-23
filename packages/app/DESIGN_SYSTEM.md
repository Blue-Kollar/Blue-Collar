# BlueCollar Design System — Comprehensive Guide

The BlueCollar design system provides a comprehensive set of design tokens, components, and guidelines to ensure visual consistency across the app.

## Table of Contents

- [Design Tokens](#design-tokens)
- [Color Palette](#color-palette)
- [Typography](#typography)
- [Spacing](#spacing)
- [Components](#components)
- [Storybook](#storybook)
- [Usage](#usage)

## Design Tokens

Design tokens are the foundational building blocks of the design system. They define colors, typography, spacing, and other visual properties.

**Location:** `src/design-system/tokens.ts`

All tokens are exported as TypeScript constants and mirrored in the Tailwind config for consistency.

### Importing Tokens

```typescript
import { colors, typography, spacing, radii, shadows } from '@/design-system/tokens';

const bgColor = colors.brand[500];
const fontSize = typography.fontSize.lg;
const padding = spacing[4];
```

## Color Palette

### Primary Brand Color

The brand color is blue, used for primary actions, links, and highlights.

| Shade   | Hex         | Usage                |
| ------- | ----------- | -------------------- |
| 50      | #eff6ff     | Lightest backgrounds |
| 100     | #dbeafe     | Light backgrounds    |
| 200     | #bfdbfe     | Hover states         |
| 300     | #93c5fd     | Disabled states      |
| 400     | #60a5fa     | Secondary actions    |
| **500** | **#3b82f6** | **Primary actions**  |
| 600     | #2563eb     | Primary hover        |
| 700     | #1d4ed8     | Primary active       |
| 800     | #1e40af     | Dark mode primary    |
| 900     | #1e3a8a     | Darkest              |

### Neutral Colors (Grays)

Used for text, borders, and backgrounds.

| Shade | Hex     | Usage                |
| ----- | ------- | -------------------- |
| 50    | #f9fafb | Lightest backgrounds |
| 100   | #f3f4f6 | Light backgrounds    |
| 200   | #e5e7eb | Borders, dividers    |
| 300   | #d1d5db | Disabled text        |
| 400   | #9ca3af | Secondary text       |
| 500   | #6b7280 | Tertiary text        |
| 600   | #4b5563 | Body text            |
| 700   | #374151 | Headings             |
| 800   | #1f2937 | Dark text            |
| 900   | #111827 | Darkest text         |

### Semantic Colors

| Color   | Light   | Default | Dark    | Usage                       |
| ------- | ------- | ------- | ------- | --------------------------- |
| Success | #d1fae5 | #10b981 | #065f46 | Confirmations, valid states |
| Warning | #fef3c7 | #f59e0b | #92400e | Alerts, cautions            |
| Error   | #fee2e2 | #ef4444 | #991b1b | Errors, destructive actions |
| Info    | #dbeafe | #3b82f6 | #1e40af | Information, hints          |

### Using Colors in Tailwind

```tsx
<div className="bg-brand-500 text-white">Primary action</div>
<div className="bg-success text-white">Success message</div>
<div className="border border-neutral-200">Subtle border</div>
```

## Typography

### Font Families

- **Sans (Default):** Geist Sans — clean, modern, highly legible
- **Mono:** Geist Mono — code, technical content

### Font Sizes

| Size | Pixels | Usage                   |
| ---- | ------ | ----------------------- |
| xs   | 12px   | Captions, small labels  |
| sm   | 14px   | Small text, helper text |
| base | 16px   | Body text (default)     |
| lg   | 18px   | Large body text         |
| xl   | 20px   | Subheadings             |
| 2xl  | 24px   | Section headings        |
| 3xl  | 30px   | Page headings           |
| 4xl  | 36px   | Large headings          |
| 5xl  | 48px   | Hero headings           |

### Font Weights

| Weight   | Value | Usage                     |
| -------- | ----- | ------------------------- |
| Light    | 300   | Subtle text               |
| Normal   | 400   | Body text                 |
| Medium   | 500   | Emphasis                  |
| Semibold | 600   | Subheadings, labels       |
| Bold     | 700   | Headings, strong emphasis |

### Heading Styles

```tsx
<h1 className="text-5xl font-bold">Page Title</h1>
<h2 className="text-4xl font-bold">Section Title</h2>
<h3 className="text-3xl font-semibold">Subsection</h3>
<h4 className="text-2xl font-semibold">Minor Heading</h4>
<h5 className="text-xl font-semibold">Label</h5>
<h6 className="text-lg font-semibold">Small Label</h6>
```

### Body Text Styles

```tsx
<p className="text-lg leading-relaxed">Large body text</p>
<p className="text-base leading-relaxed">Normal body text</p>
<p className="text-sm text-neutral-600">Small text</p>
```

## Spacing

The spacing scale is based on a 4px grid, making it easy to create consistent layouts.

| Token | Pixels | Usage               |
| ----- | ------ | ------------------- |
| 0     | 0px    | No space            |
| 1     | 4px    | Tight spacing       |
| 2     | 8px    | Compact spacing     |
| 3     | 12px   | Small spacing       |
| 4     | 16px   | Default spacing     |
| 5     | 20px   | Medium spacing      |
| 6     | 24px   | Comfortable spacing |
| 8     | 32px   | Large spacing       |
| 10    | 40px   | Extra large spacing |
| 12    | 48px   | Huge spacing        |
| 16    | 64px   | Massive spacing     |
| 20    | 80px   | Extreme spacing     |
| 24    | 96px   | Maximum spacing     |

### Using Spacing

```tsx
<div className="p-4">Padding 16px</div>
<div className="m-6">Margin 24px</div>
<div className="gap-3">Gap 12px (flex/grid)</div>
<div className="space-y-4">Vertical spacing 16px</div>
```

## Border Radius

| Token | Pixels | Usage                |
| ----- | ------ | -------------------- |
| none  | 0px    | Sharp corners        |
| sm    | 2px    | Subtle rounding      |
| md    | 6px    | Slight rounding      |
| lg    | 8px    | Standard rounding    |
| xl    | 12px   | Comfortable rounding |
| 2xl   | 16px   | Generous rounding    |
| 3xl   | 24px   | Large rounding       |
| full  | 9999px | Circles, pills       |

### Using Border Radius

```tsx
<div className="rounded-lg">Standard rounded</div>
<div className="rounded-full">Circle/pill</div>
<div className="rounded-t-lg">Top corners only</div>
```

## Shadows

| Token | Usage               |
| ----- | ------------------- |
| sm    | Subtle elevation    |
| md    | Standard elevation  |
| lg    | Prominent elevation |
| xl    | Strong elevation    |
| 2xl   | Maximum elevation   |

### Using Shadows

```tsx
<div className="shadow-md">Card with shadow</div>
<div className="shadow-lg hover:shadow-xl">Interactive element</div>
```

## Components

All components follow the design system and use design tokens consistently.

### Component Library

- **UI Components:** `src/components/ui/` — shadcn/ui components
- **Feature Components:** `src/components/` — BlueCollar-specific components
- **Page Components:** `src/app/` — Next.js page components

### Creating New Components

1. Use design tokens for all styling
2. Follow the existing component patterns
3. Add TypeScript types
4. Create a Storybook story
5. Test accessibility

Example:

```tsx
import { colors, spacing } from '@/design-system/tokens';

export function Button({ children, variant = 'primary' }) {
  const bgColor = variant === 'primary' ? colors.brand[500] : colors.neutral[200];

  return (
    <button className={`px-4 py-2 rounded-lg font-semibold`} style={{ backgroundColor: bgColor }}>
      {children}
    </button>
  );
}
```

## Storybook

Storybook showcases all design tokens and components in an interactive environment.

### Running Storybook

```bash
cd packages/app
pnpm storybook
```

Opens at `http://localhost:6006`

### Viewing Design Tokens

Navigate to **Design System > Tokens** to see:

- Color palette
- Typography scales
- Spacing scale
- Border radius options
- Shadows
- Transitions
- Z-index scale
- Breakpoints

### Creating Component Stories

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: 'Click me', variant: 'primary' },
};

export const Secondary: Story = {
  args: { children: 'Click me', variant: 'secondary' },
};
```

## Usage

### In Components

```tsx
import { colors, spacing, typography } from '@/design-system/tokens';

export function Card() {
  return (
    <div
      className="rounded-lg p-6 shadow-md"
      style={{
        backgroundColor: colors.neutral[50],
        padding: spacing[6],
      }}
    >
      <h2 className="text-2xl font-bold mb-4">Card Title</h2>
      <p className="text-neutral-600">Card content</p>
    </div>
  );
}
```

### In Tailwind

```tsx
<div className="bg-brand-500 text-white p-4 rounded-lg shadow-lg">Styled with Tailwind</div>
```

### Mixing Approaches

```tsx
import { colors } from '@/design-system/tokens';

<div className="p-4 rounded-lg shadow-md" style={{ backgroundColor: colors.brand[500] }}>
  Mixed styling
</div>;
```

## Best Practices

1. **Always use design tokens** — Never hardcode colors or spacing
2. **Prefer Tailwind classes** — Faster, more maintainable
3. **Use semantic colors** — `success`, `warning`, `error` instead of specific colors
4. **Maintain consistency** — Follow existing patterns
5. **Test accessibility** — Ensure sufficient color contrast
6. **Document changes** — Update this guide when adding tokens

## References

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Storybook Documentation](https://storybook.js.org/docs/react/get-started/introduction)
- [Design Tokens Format Module](https://design-tokens.github.io/community-group/format/)
