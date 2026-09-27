import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginForm from '@/components/LoginForm';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authApi: {
    login: vi.fn(),
  },
  loginSchema: {},
}));

vi.mock('lucide-react', () => ({
  Loader2: ({ className }: any) => <span className={className} />,
}));

vi.mock('@/components/FormField', () => ({
  default: ({ id, label, error, children }: any) => (
    <div>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('LoginForm', () => {
  const mockPush = vi.fn();
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useSearchParams as any).mockReturnValue(new URLSearchParams(''));
    (useAuth as any).mockReturnValue({ login: mockLogin });
  });

  describe('rendering', () => {
    it('renders email and password input fields', () => {
      render(<LoginForm />);
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('renders sign in button', () => {
      render(<LoginForm />);
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('renders forgot password link', () => {
      render(<LoginForm />);
      expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
        'href',
        '/auth/forgot-password'
      );
    });

    it('sets correct input types', () => {
      render(<LoginForm />);
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      expect(emailInput.type).toBe('email');
      expect(passwordInput.type).toBe('password');
    });

    it('sets correct autocomplete attributes', () => {
      render(<LoginForm />);
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      expect(emailInput.autoComplete).toBe('email');
      expect(passwordInput.autoComplete).toBe('current-password');
    });
  });

  describe('form state - empty state', () => {
    it('has empty input fields on mount', () => {
      render(<LoginForm />);
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
    });

    it('submit button is enabled initially', () => {
      render(<LoginForm />);
      const submitButton = screen.getByRole('button', { name: /sign in/i }) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(false);
    });
  });

  describe('form submission - success state', () => {
    it('calls login API with form data', async () => {
      const user = userEvent.setup();
      const mockAuthData = { id: '123', email: 'test@example.com', name: 'Test User' };
      const mockToken = 'mock-token';

      (authApi.login as any).mockResolvedValue({
        data: mockAuthData,
        token: mockToken,
      });

      render(<LoginForm />);
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('calls login context function with user data and token', async () => {
      const user = userEvent.setup();
      const mockAuthData = { id: '123', email: 'test@example.com', name: 'Test User' };
      const mockToken = 'mock-token';

      (authApi.login as any).mockResolvedValue({
        data: mockAuthData,
        token: mockToken,
      });

      render(<LoginForm />);
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(mockAuthData, mockToken);
      });
    });

    it('redirects to /workers after successful login', async () => {
      const user = userEvent.setup();
      (authApi.login as any).mockResolvedValue({
        data: { id: '123', email: 'test@example.com' },
        token: 'token',
      });

      render(<LoginForm />);
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/workers');
      });
    });

    it('redirects to custom redirect URL from search params', async () => {
      const user = userEvent.setup();
      (useSearchParams as any).mockReturnValue(new URLSearchParams('redirect=/custom-page'));
      (authApi.login as any).mockResolvedValue({
        data: { id: '123', email: 'test@example.com' },
        token: 'token',
      });

      render(<LoginForm />);
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/custom-page');
      });
    });
  });

  describe('error state - API errors', () => {
    it('displays API error message when login fails', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Invalid credentials';
      (authApi.login as any).mockRejectedValue(new Error(errorMessage));

      render(<LoginForm />);
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrong-password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      });
    });

    it('displays generic error message for non-Error exceptions', async () => {
      const user = userEvent.setup();
      (authApi.login as any).mockRejectedValue('Unknown error');

      render(<LoginForm />);
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Login failed');
      });
    });

    it('clears previous error on new submission attempt', async () => {
      const user = userEvent.setup();
      (authApi.login as any)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ data: { id: '123' }, token: 'token' });

      render(<LoginForm />);
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // First submission fails
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('First error');
      });

      // Second submission succeeds
      await user.clear(emailInput);
      await user.clear(passwordInput);
      await user.type(emailInput, 'correct@example.com');
      await user.type(passwordInput, 'correct-password');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('does not redirect on API error', async () => {
      const user = userEvent.setup();
      (authApi.login as any).mockRejectedValue(new Error('Login failed'));

      render(<LoginForm />);
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('disables submit button while submitting', async () => {
      const user = userEvent.setup();
      let resolveLogin: any;
      (authApi.login as any).mockImplementation(
        () => new Promise((resolve) => {
          resolveLogin = resolve;
        })
      );

      render(<LoginForm />);
      const submitButton = screen.getByRole('button', { name: /sign in/i }) as HTMLButtonElement;

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton.disabled).toBe(true);
      });

      resolveLogin({ data: { id: '123' }, token: 'token' });
    });

    it('shows loading spinner during submission', async () => {
      const user = userEvent.setup();
      let resolveLogin: any;
      (authApi.login as any).mockImplementation(
        () => new Promise((resolve) => {
          resolveLogin = resolve;
        })
      );

      render(<LoginForm />);
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toContainHTML('span');
      });

      resolveLogin({ data: { id: '123' }, token: 'token' });
    });
  });

  describe('form validation', () => {
    it('shows email error when email field is invalid', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email');
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger blur/validation

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('shows password error when password field is empty', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText('Password');
      await user.click(passwordInput);
      await user.tab(); // Trigger blur/validation

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('form input handling', () => {
    it('updates email input value as user types', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      await user.type(emailInput, 'test@example.com');

      expect(emailInput.value).toBe('test@example.com');
    });

    it('updates password input value as user types', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      await user.type(passwordInput, 'password123');

      expect(passwordInput.value).toBe('password123');
    });
  });

  describe('accessibility', () => {
    it('associates labels with input fields', () => {
      render(<LoginForm />);

      const emailLabel = screen.getByLabelText('Email');
      const passwordLabel = screen.getByLabelText('Password');

      expect(emailLabel).toBeInTheDocument();
      expect(passwordLabel).toBeInTheDocument();
    });

    it('has form with noValidate attribute', () => {
      const { container } = render(<LoginForm />);
      const form = container.querySelector('form');

      expect(form).toHaveAttribute('noValidate');
    });

    it('error message has alert role', async () => {
      const user = userEvent.setup();
      (authApi.login as any).mockRejectedValue(new Error('Login failed'));

      render(<LoginForm />);
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Login failed');
      });
    });
  });
});
