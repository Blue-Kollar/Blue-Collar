import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeAll } from 'vitest'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Providers } from '@/components/Providers'
import { queryClient } from '@/lib/queryClient'

function ProbeConsumer() {
  const t = useTranslations('probe')
  const { theme } = useTheme()
  const client = useQueryClient()

  return (
    <div>
      <p>{t('greeting')}</p>
      <p data-testid="theme">{theme ?? 'unset'}</p>
      <p data-testid="query-client">{client === queryClient ? 'shared' : 'other'}</p>
    </div>
  )
}

describe('Providers', () => {
  // next-themes reads system colour preference via matchMedia, which jsdom does not implement.
  beforeAll(() => {
    if (!window.matchMedia) {
      window.matchMedia = (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList
    }
  })

  it('renders children inside the intl, theme and query contexts', () => {
    render(
      <Providers locale="en" messages={{ probe: { greeting: 'Hello from intl' } }}>
        <ProbeConsumer />
      </Providers>,
    )

    expect(screen.getByText('Hello from intl')).toBeInTheDocument()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('query-client')).toHaveTextContent('shared')
  })
})
