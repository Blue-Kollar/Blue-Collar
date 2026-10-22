/**
 * React render helpers for @bluecollar/app unit tests.
 *
 * Provides `renderWithProviders`, a drop-in replacement for
 * @testing-library/react `render` that wraps the component under test with
 * the full AuthContext (and optionally other contexts) so individual tests
 * don't have to wire up providers manually.
 *
 * This module is React-only (uses JSX) — do not import it in API or
 * mobile tests.
 *
 * Usage:
 *   import { renderWithProviders } from '@bluecollar/test-utils/react'
 *
 *   it('shows curator controls', () => {
 *     renderWithProviders(<WorkerCard worker={worker} />, {
 *       authUser: authUserFactory({ role: 'curator' }),
 *     })
 *     expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
 *   })
 */

import React, { type ReactNode, type ReactElement } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { FakeAuthUser } from '../factories/index.js'

// ── AuthContext mock provider ─────────────────────────────────────────────────
// We create a minimal stub rather than importing the real AuthContext to keep
// the test-utils package decoupled from Next.js / client-only modules.

interface AuthContextValue {
  user: FakeAuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: FakeAuthUser, token: string) => void
  logout: () => void
}

// Lazy-create the context so it can be reused across renders
let _AuthCtx: React.Context<AuthContextValue> | null = null

function getAuthCtx(): React.Context<AuthContextValue> {
  if (!_AuthCtx) {
    _AuthCtx = React.createContext<AuthContextValue>({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: () => {},
      logout: () => {},
    })
  }
  return _AuthCtx
}

export function useTestAuth(): AuthContextValue {
  return React.useContext(getAuthCtx())
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Authenticated user to inject into AuthContext.
   * Pass `null` to render as unauthenticated (default).
   */
  authUser?: FakeAuthUser | null
  /** Raw JWT string placed in the context. Defaults to 'test-jwt'. */
  token?: string | null
  /**
   * Whether the auth context should report isLoading=true.
   * Useful for testing loading skeleton states.
   */
  authLoading?: boolean
  /** Additional wrappers to compose around the provided children. */
  extraWrappers?: Array<React.ComponentType<{ children: ReactNode }>>
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Render a React component inside the standard test providers.
 *
 * All options that @testing-library/react's `render` accepts are forwarded.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    authUser = null,
    token = authUser ? 'test-jwt' : null,
    authLoading = false,
    extraWrappers = [],
    ...rtlOptions
  }: RenderWithProvidersOptions = {},
): RenderResult {
  const AuthCtx = getAuthCtx()

  const authValue: AuthContextValue = {
    user: authUser,
    token,
    isAuthenticated: !!authUser,
    isLoading: authLoading,
    login: () => {},
    logout: () => {},
  }

  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    let wrapped: ReactNode = children

    // Apply any extra wrappers (innermost first)
    for (const W of [...extraWrappers].reverse()) {
      wrapped = React.createElement(W, null, wrapped)
    }

    return React.createElement(AuthCtx.Provider, { value: authValue }, wrapped)
  }

  return render(ui, { wrapper: Wrapper, ...rtlOptions })
}
