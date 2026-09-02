import type { Meta, StoryObj } from '@storybook/react'

import { tokens } from '@/design-system/tokens'

const meta: Meta = {
  title: 'Design System / Tokens',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

// ============================================================================
// Color Palette
// ============================================================================

export const ColorPalette: StoryObj = {
  render: () => (
    <div className="p-8 bg-neutral-50">
      <h1 className="text-4xl font-bold mb-8">Color Palette</h1>

      {/* Brand Colors */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Brand (Primary)</h2>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(tokens.colors.brand).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <div
                className="w-full h-24 rounded-lg shadow-md mb-2"
                style={{ backgroundColor: value }}
              />
              <span className="text-sm font-medium">{key}</span>
              <span className="text-xs text-neutral-500">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Neutral Colors */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Neutral (Grays)</h2>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(tokens.colors.neutral).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <div
                className="w-full h-24 rounded-lg shadow-md mb-2 border border-neutral-200"
                style={{ backgroundColor: value }}
              />
              <span className="text-sm font-medium">{key}</span>
              <span className="text-xs text-neutral-500">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Semantic Colors */}
      <div className="grid grid-cols-4 gap-8">
        {Object.entries(tokens.colors).map(([name, color]) => {
          if (name === 'brand' || name === 'neutral') return null
          return (
            <div key={name}>
              <h3 className="text-lg font-semibold mb-3 capitalize">{name}</h3>
              <div className="space-y-2">
                {typeof color === 'object' &&
                  Object.entries(color).map(([variant, value]) => (
                    <div key={variant} className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg shadow-md"
                        style={{ backgroundColor: value as string }}
                      />
                      <div>
                        <span className="text-sm font-medium capitalize">{variant}</span>
                        <span className="text-xs text-neutral-500 block">{value}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  ),
}

// ============================================================================
// Typography
// ============================================================================

export const Typography: StoryObj = {
  render: () => (
    <div className="p-8 bg-neutral-50">
      <h1 className="text-4xl font-bold mb-8">Typography</h1>

      {/* Font Families */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Font Families</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-neutral-600 mb-2">Sans (Default)</p>
            <p className="font-sans text-lg">
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
          <div>
            <p className="text-sm text-neutral-600 mb-2">Mono</p>
            <p className="font-mono text-lg">
              const greeting = "Hello, BlueCollar!"
            </p>
          </div>
        </div>
      </div>

      {/* Font Sizes */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Font Sizes</h2>
        <div className="space-y-3">
          {Object.entries(tokens.typography.fontSize).map(([key, [size]]) => (
            <div key={key}>
              <span className="text-xs text-neutral-500 font-mono">{key}</span>
              <p style={{ fontSize: size }} className="text-neutral-900">
                The quick brown fox jumps over the lazy dog
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Font Weights */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Font Weights</h2>
        <div className="space-y-2">
          {Object.entries(tokens.typography.fontWeight).map(([key, weight]) => (
            <p key={key} style={{ fontWeight: weight as any }} className="text-lg">
              {key} ({weight}) — The quick brown fox
            </p>
          ))}
        </div>
      </div>

      {/* Headings */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Heading Styles</h2>
        <div className="space-y-4">
          <h1 className="text-5xl font-bold">Heading 1</h1>
          <h2 className="text-4xl font-bold">Heading 2</h2>
          <h3 className="text-3xl font-semibold">Heading 3</h3>
          <h4 className="text-2xl font-semibold">Heading 4</h4>
          <h5 className="text-xl font-semibold">Heading 5</h5>
          <h6 className="text-lg font-semibold">Heading 6</h6>
        </div>
      </div>
    </div>
  ),
}

// ============================================================================
// Spacing
// ============================================================================

export const Spacing: StoryObj = {
  render: () => (
    <div className="p-8 bg-neutral-50">
      <h1 className="text-4xl font-bold mb-8">Spacing Scale</h1>
      <div className="space-y-6">
        {Object.entries(tokens.spacing).map(([key, value]) => (
          <div key={key} className="flex items-center gap-4">
            <span className="w-12 text-sm font-mono font-semibold">{key}</span>
            <div
              className="bg-brand-500 rounded"
              style={{ width: value, height: '2rem' }}
            />
            <span className="text-sm text-neutral-600">{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}

// ============================================================================
// Border Radius
// ============================================================================

export const BorderRadius: StoryObj = {
  render: () => (
    <div className="p-8 bg-neutral-50">
      <h1 className="text-4xl font-bold mb-8">Border Radius</h1>
      <div className="grid grid-cols-4 gap-6">
        {Object.entries(tokens.radii).map(([key, value]) => (
          <div key={key} className="flex flex-col items-center">
            <div
              className="w-24 h-24 bg-brand-500 mb-3"
              style={{ borderRadius: value }}
            />
            <span className="text-sm font-medium">{key}</span>
            <span className="text-xs text-neutral-500">{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}

// ============================================================================
// Shadows
// ============================================================================

export const Shadows: StoryObj = {
  render: () => (
    <div className="p-8 bg-neutral-50">
      <h1 className="text-4xl font-bold mb-8">Shadows</h1>
      <div className="grid grid-cols-3 gap-8">
        {Object.entries(tokens.shadows).map(([key, value]) => (
          <div key={key} className="flex flex-col items-center">
            <div
              className="w-32 h-32 bg-white rounded-lg mb-3"
              style={{ boxShadow: value }}
            />
            <span className="text-sm font-medium">{key}</span>
            <span className="text-xs text-neutral-500 text-center">{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}

// ============================================================================
// Transitions
// ============================================================================

export const Transitions: StoryObj = {
  render: () => (
    <div className="p-8 bg-neutral-50">
      <h1 className="text-4xl font-bold mb-8">Transitions</h1>
      <div className="grid grid-cols-4 gap-6">
        {Object.entries(tokens.transitions).map(([key, value]) => (
          <div key={key} className="flex flex-col items-center">
            <div
              className="w-24 h-24 bg-brand-500 rounded-lg cursor-pointer hover:bg-brand-600"
              style={{ transition: value }}
            />
            <span className="text-sm font-medium mt-3">{key}</span>
            <span className="text-xs text-neutral-500">{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}

// ============================================================================
// Z-Index
// ============================================================================

export const ZIndex: StoryObj = {
  render: () => (
    <div className="p-8 bg-neutral-50">
      <h1 className="text-4xl font-bold mb-8">Z-Index Scale</h1>
      <div className="space-y-2">
        {Object.entries(tokens.zIndex).map(([key, value]) => (
          <div key={key} className="flex items-center gap-4 p-3 bg-white rounded-lg">
            <span className="w-32 font-semibold">{key}</span>
            <span className="font-mono text-neutral-600">{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}

// ============================================================================
// Breakpoints
// ============================================================================

export const Breakpoints: StoryObj = {
  render: () => (
    <div className="p-8 bg-neutral-50">
      <h1 className="text-4xl font-bold mb-8">Breakpoints</h1>
      <div className="space-y-2">
        {Object.entries(tokens.breakpoints).map(([key, value]) => (
          <div key={key} className="flex items-center gap-4 p-3 bg-white rounded-lg">
            <span className="w-12 font-semibold">{key}</span>
            <span className="font-mono text-neutral-600">{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}
