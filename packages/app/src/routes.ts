/**
 * Centralized routing configuration.
 *
 * All application routes are defined here as a single source of truth.
 * Use the typed `ROUTES` map and the helper functions below instead of
 * hardcoding path strings throughout the app.
 */

/**
 * Static route paths that take no parameters.
 */
export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  wallet: '/wallet',
  profile: '/profile',
  privacy: '/privacy',
  terms: '/terms',
  howItWorks: '/how-it-works',
  categories: '/categories',
  login: '/auth/login',
  register: '/auth/register',
} as const;

/**
 * Parameterized route builders. Each function returns a fully-formed path.
 */
export const routeBuilders = {
  /**
   * Detail page for a specific worker.
   * @example workerDetail('abc-123') => '/workers/abc-123'
   */
  workerDetail: (workerId: string): string =>
    `/workers/${encodeURIComponent(workerId)}`,

  /**
   * Category listing page for a specific category.
   * @example categoryDetail('plumbing') => '/categories/plumbing'
   */
  categoryDetail: (categorySlug: string): string =>
    `/categories/${encodeURIComponent(categorySlug)}`,
} as const;

/**
 * Union type of all static route paths.
 */
export type StaticRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Union type of all parameterized route builder names.
 */
export type RouteBuilderName = keyof typeof routeBuilders;

/**
 * A route entry used for sitemap generation and navigation.
 */
export interface RouteEntry {
  /** The path for the route. */
  path: string;
  /** Optional human-readable label. */
  label?: string;
  /** Whether the route is publicly accessible (no auth required). */
  isPublic: boolean;
}

/**
 * All static routes as an array of entries, useful for menus and sitemaps.
 */
export const routeEntries: readonly RouteEntry[] = [
  { path: ROUTES.home, label: 'Home', isPublic: true },
  { path: ROUTES.howItWorks, label: 'How It Works', isPublic: true },
  { path: ROUTES.categories, label: 'Categories', isPublic: true },
  { path: ROUTES.privacy, label: 'Privacy', isPublic: true },
  { path: ROUTES.terms, label: 'Terms', isPublic: true },
  { path: ROUTES.login, label: 'Log In', isPublic: true },
  { path: ROUTES.register, label: 'Register', isPublic: true },
  { path: ROUTES.dashboard, label: 'Dashboard', isPublic: false },
  { path: ROUTES.wallet, label: 'Wallet', isPublic: false },
  { path: ROUTES.profile, label: 'Profile', isPublic: false },
] as const;

/**
 * List of public route paths (no authentication required).
 * Used for sitemap generation and public navigation.
 */
export const publicRoutes: readonly string[] = routeEntries
  .filter((entry) => entry.isPublic)
  .map((entry) => entry.path);

/**
 * List of protected route paths (authentication required).
 */
export const protectedRoutes: readonly string[] = routeEntries
  .filter((entry) => !entry.isPublic)
  .map((entry) => entry.path);

/**
 * Type guard to check whether a given path is a known static route.
 */
export function isStaticRoute(path: string): path is StaticRoute {
  return (Object.values(ROUTES) as readonly string[]).includes(path);
}

/**
 * Type guard to check whether a given path is a public route.
 */
export function isPublicRoute(path: string): boolean {
  return publicRoutes.includes(path);
}

/**
 * Type guard to check whether a given path is a protected route.
 */
export function isProtectedRoute(path: string): boolean {
  return protectedRoutes.includes(path);
}

/**
 * Build a worker detail path.
 * Convenience re-export of `routeBuilders.workerDetail`.
 */
export const workerDetailPath = routeBuilders.workerDetail;

/**
 * Build a category detail path.
 * Convenience re-export of `routeBuilders.categoryDetail`.
 */
export const categoryDetailPath = routeBuilders.categoryDetail;
```

File: packages/app/src/routes.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import {
  ROUTES,
  routeBuilders,
  routeEntries,
  publicRoutes,
  protectedRoutes,
  isStaticRoute,
  isPublicRoute,
  isProtectedRoute,
  workerDetailPath,
  categoryDetailPath,
} from './routes';

describe('ROUTES', () => {
  it('defines expected static paths', () => {
    expect(ROUTES.home).toBe('/');
    expect(ROUTES.dashboard).toBe('/dashboard');
    expect(ROUTES.wallet).toBe('/wallet');
    expect(ROUTES.profile).toBe('/profile');
    expect(ROUTES.privacy).toBe('/privacy');
    expect(ROUTES.terms).toBe('/terms');
    expect(ROUTES.howItWorks).toBe('/how-it-works');
    expect(ROUTES.categories).toBe('/categories');
    expect(ROUTES.login).toBe('/auth/login');
    expect(ROUTES.register).toBe('/auth/register');
  });
});

describe('routeBuilders', () => {
  it('builds worker detail paths', () => {
    expect(routeBuilders.workerDetail('abc-123')).toBe('/workers/abc-123');
  });

  it('encodes worker ids', () => {
    expect(routeBuilders.workerDetail('a/b c')).toBe('/workers/a%2Fb%20c');
  });

  it('builds category detail paths', () => {
    expect(routeBuilders.categoryDetail('plumbing')).toBe(
      '/categories/plumbing',
    );
  });

  it('encodes category slugs', () => {
    expect(routeBuilders.categoryDetail('home & garden')).toBe(
      '/categories/home%20%26%20garden',
    );
  });
});

describe('convenience path helpers', () => {
  it('workerDetailPath matches routeBuilders.workerDetail', () => {
    expect(workerDetailPath('x')).toBe(routeBuilders.workerDetail('x'));
  });

  it('categoryDetailPath matches routeBuilders.categoryDetail', () => {
    expect(categoryDetailPath('y')).toBe(routeBuilders.categoryDetail('y'));
  });
});

describe('routeEntries', () => {
  it('contains an entry for every static route', () => {
    const paths = routeEntries.map((e) => e.path);
    for (const path of Object.values(ROUTES)) {
      expect(paths).toContain(path);
    }
  });

  it('marks home as public', () => {
    const home = routeEntries.find((e) => e.path === ROUTES.home);
    expect(home?.isPublic).toBe(true);
  });

  it('marks dashboard as protected', () => {
    const dashboard = routeEntries.find((e) => e.path === ROUTES.dashboard);
    expect(dashboard?.isPublic).toBe(false);
  });
});

describe('publicRoutes', () => {
  it('includes public paths', () => {
    expect(publicRoutes).toContain(ROUTES.home);
    expect(publicRoutes).toContain(ROUTES.login);
    expect(publicRoutes).toContain(ROUTES.register);
    expect(publicRoutes).toContain(ROUTES.privacy);
    expect(publicRoutes).toContain(ROUTES.terms);
    expect(publicRoutes).toContain(ROUTES.howItWorks);
    expect(publicRoutes).toContain(ROUTES.categories);
  });

  it('excludes protected paths', () => {
    expect(publicRoutes).not.toContain(ROUTES.dashboard);
    expect(publicRoutes).not.toContain(ROUTES.wallet);
    expect(publicRoutes).not.toContain(ROUTES.profile);
  });
});

describe('protectedRoutes', () => {
  it('includes protected paths', () => {
    expect(protectedRoutes).toContain(ROUTES.dashboard);
    expect(protectedRoutes).toContain(ROUTES.wallet);
    expect(protectedRoutes).toContain(ROUTES.profile);
  });

  it('excludes public paths', () => {
    expect(protectedRoutes).not.toContain(ROUTES.home);
    expect(protectedRoutes).not.toContain(ROUTES.login);
  });
});

describe('isStaticRoute', () => {
  it('returns true for known static routes', () => {
    expect(isStaticRoute(ROUTES.home)).toBe(true);
    expect(isStaticRoute(ROUTES.dashboard)).toBe(true);
  });

  it('returns false for unknown routes', () => {
    expect(isStaticRoute('/unknown')).toBe(false);
    expect(isStaticRoute('/workers/abc')).toBe(false);
  });
});

describe('isPublicRoute', () => {
  it('returns true for public routes', () => {
    expect(isPublicRoute(ROUTES.home)).toBe(true);
    expect(isPublicRoute(ROUTES.login)).toBe(true);
  });

  it('returns false for protected routes', () => {
    expect(isPublicRoute(ROUTES.dashboard)).toBe(false);
  });
});

describe('isProtectedRoute', () => {
  it('returns true for protected routes', () => {
    expect(isProtectedRoute(ROUTES.dashboard)).toBe(true);
    expect(isProtectedRoute(ROUTES.wallet)).toBe(true);
  });

  it('returns false for public routes', () => {
    expect(isProtectedRoute(ROUTES.home)).toBe(false);
  });
});