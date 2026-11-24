/**
 * Auth + onboarding surfaces — accessibility regression tests (#1878).
 *
 * Covers the login form, the registration page and the two onboarding
 * dialogs. Each surface is rendered with the shared intl provider and checked
 * with axe through the shared helper.
 */
import { screen } from '@testing-library/react';
import { renderWithIntl as render } from '@/__tests__/renderWithIntl';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectNoA11yViolations } from './axe-helper';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatStellarAddress: (address: string) => address,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/auth/login',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Icon = ({ 'aria-label': label }: any) =>
    label ? <span role="img" aria-label={label} /> : <span aria-hidden="true" />;
  const mock: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    mock[key] = typeof actual[key] === 'function' ? Icon : actual[key];
  }
  return mock;
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn(), user: null }),
}));

beforeEach(() => {
  localStorage.clear();
});

describe('Authentication pages — axe (WCAG 2.1 AA)', () => {
  it('login form has no blocking violations', async () => {
    const { default: LoginForm } = await import('@/components/LoginForm');
    const { container } = render(
      <main>
        <LoginForm />
      </main>,
    );

    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('registration page has no blocking violations', async () => {
    const { default: RegisterPage } = await import('@/app/[locale]/auth/register/page');
    const { container } = render(
      <main>
        <RegisterPage />
      </main>,
    );

    expect(screen.getByRole('textbox', { name: 'First name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe('Onboarding surfaces — axe (WCAG 2.1 AA)', () => {
  it('onboarding tour has no blocking violations', async () => {
    const { default: OnboardingTour } = await import('@/components/OnboardingTour');
    const { container } = render(<OnboardingTour />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('onboarding modal has no blocking violations', async () => {
    const { default: OnboardingModal } = await import('@/components/OnboardingModal');
    const { container } = render(<OnboardingModal isOpen onClose={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
