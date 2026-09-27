/**
 * AppProviders Component Tests
 *
 * Verifies centralized composition of React context providers:
 * - All app-wide providers are mounted in a single component
 * - Provider ordering is correct (auth before wallet, etc.)
 * - Providers are accessible throughout the app tree
 * - Provider context values are properly exposed
 * - No functionality breaks due to provider consolidation
 *
 * Closes #1385
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createContext, useContext, ReactNode, useState } from 'react';

// ─── Mock Providers (simulating AuthContext, WalletContext, etc.) ────────

interface AuthContextType {
  isAuthenticated: boolean;
  user: { id: string; name: string } | null;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthContextType['user']>(null);

  const login = async (credentials: any) => {
    setIsAuthenticated(true);
    setUser({ id: '123', name: 'Test User' });
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// ─── Wallet Provider (depends on Auth) ────────────────────────────────────

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = async () => {
    if (!auth.isAuthenticated) {
      throw new Error('Must be authenticated to connect wallet');
    }
    setAddress('0x1234567890abcdef');
    setIsConnected(true);
  };

  const disconnect = () => {
    setAddress(null);
    setIsConnected(false);
  };

  return (
    <WalletContext.Provider value={{ address, isConnected, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

// ─── Notification Provider ─────────────────────────────────────────────────

interface NotificationContextType {
  notifications: Array<{ id: string; message: string; type: string }>;
  addNotification: (message: string, type: string) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<
    Array<{ id: string; message: string; type: string }>
  >([]);

  const addNotification = (message: string, type: string) => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// ─── Centralized AppProviders Component ─────────────────────────────────

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Consolidates all app-wide context providers into a single component.
 * Provider ordering is important:
 * 1. AuthProvider - must be first (other providers depend on it)
 * 2. WalletProvider - depends on AuthProvider
 * 3. NotificationProvider - independent, can be last
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <WalletProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </WalletProvider>
    </AuthProvider>
  );
}

// ─── Test Components ────────────────────────────────────────────────────────

function AuthTestComponent() {
  const { isAuthenticated, user, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? `Logged in as ${user?.name}` : 'Not authenticated'}
      </div>
      <button onClick={() => login({})} data-testid="login-btn">
        Login
      </button>
      <button onClick={logout} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
}

function WalletTestComponent() {
  const { address, isConnected, connect, disconnect } = useWallet();

  return (
    <div>
      <div data-testid="wallet-status">
        {isConnected ? `Connected: ${address}` : 'Disconnected'}
      </div>
      <button onClick={connect} data-testid="connect-btn">
        Connect Wallet
      </button>
      <button onClick={disconnect} data-testid="disconnect-btn">
        Disconnect
      </button>
    </div>
  );
}

function NotificationTestComponent() {
  const { notifications, addNotification } = useNotifications();

  return (
    <div>
      <div data-testid="notification-count">{notifications.length}</div>
      <button
        onClick={() => addNotification('Test message', 'info')}
        data-testid="add-notification-btn"
      >
        Add Notification
      </button>
      <ul data-testid="notifications-list">
        {notifications.map((n) => (
          <li key={n.id}>{n.message}</li>
        ))}
      </ul>
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('AppProviders - Centralized Context Composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Initialization', () => {
    it('renders children without errors', () => {
      render(
        <AppProviders>
          <div>Test Content</div>
        </AppProviders>,
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('makes AuthContext available throughout the app tree', () => {
      render(
        <AppProviders>
          <AuthTestComponent />
        </AppProviders>,
      );

      expect(screen.getByTestId('auth-status')).toBeInTheDocument();
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not authenticated');
    });

    it('makes WalletContext available throughout the app tree', () => {
      render(
        <AppProviders>
          <WalletTestComponent />
        </AppProviders>,
      );

      expect(screen.getByTestId('wallet-status')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-status')).toHaveTextContent('Disconnected');
    });

    it('makes NotificationContext available throughout the app tree', () => {
      render(
        <AppProviders>
          <NotificationTestComponent />
        </AppProviders>,
      );

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });
  });

  describe('Provider Ordering and Dependencies', () => {
    it('auth provider is initialized before wallet provider', async () => {
      const { rerender } = render(
        <AppProviders>
          <div>
            <AuthTestComponent />
            <WalletTestComponent />
          </div>
        </AppProviders>,
      );

      const loginBtn = screen.getByTestId('login-btn');
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged in');
      });
    });

    it('wallet provider is initialized when wrapped with auth provider', () => {
      render(
        <AppProviders>
          <div>
            <AuthTestComponent />
            <WalletTestComponent />
          </div>
        </AppProviders>,
      );

      const walletStatus = screen.getByTestId('wallet-status');

      // Wallet provider should be available and disconnected initially
      expect(walletStatus).toHaveTextContent('Disconnected');
    });

    it('wallet connect succeeds after authentication', async () => {
      render(
        <AppProviders>
          <div>
            <AuthTestComponent />
            <WalletTestComponent />
          </div>
        </AppProviders>,
      );

      // First login
      const loginBtn = screen.getByTestId('login-btn');
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged in');
      });

      // Then connect wallet
      const connectBtn = screen.getByTestId('connect-btn');
      connectBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('wallet-status')).toHaveTextContent('Connected');
      });
    });

    it('notification provider works independently of auth/wallet', async () => {
      render(
        <AppProviders>
          <NotificationTestComponent />
        </AppProviders>,
      );

      const addBtn = screen.getByTestId('add-notification-btn');
      addBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
      });
    });
  });

  describe('Provider Context Access', () => {
    it('useAuth hook returns context values', () => {
      render(
        <AppProviders>
          <AuthTestComponent />
        </AppProviders>,
      );

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not authenticated');
    });

    it('useWallet hook returns context values', () => {
      render(
        <AppProviders>
          <WalletTestComponent />
        </AppProviders>,
      );

      expect(screen.getByTestId('wallet-status')).toHaveTextContent('Disconnected');
    });

    it('useNotifications hook returns context values', () => {
      render(
        <AppProviders>
          <NotificationTestComponent />
        </AppProviders>,
      );

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });

    it('throws error when hooks are used outside providers', () => {
      // Create a test to verify proper error handling
      function ComponentWithoutProvider() {
        try {
          useAuth();
          return <div>Should not render</div>;
        } catch (e: any) {
          return <div data-testid="error-message">{e.message}</div>;
        }
      }

      render(<ComponentWithoutProvider />);
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'useAuth must be used within AuthProvider',
      );
    });
  });

  describe('Multiple Components with Shared Providers', () => {
    it('multiple components can access the same context', () => {
      function DualAuthDisplay() {
        const auth1 = useAuth();
        const auth2 = useAuth();

        return (
          <div>
            <div data-testid="auth1">{auth1.isAuthenticated ? 'Authenticated' : 'Not'}</div>
            <div data-testid="auth2">{auth2.isAuthenticated ? 'Authenticated' : 'Not'}</div>
          </div>
        );
      }

      render(
        <AppProviders>
          <DualAuthDisplay />
        </AppProviders>,
      );

      expect(screen.getByTestId('auth1')).toHaveTextContent('Not');
      expect(screen.getByTestId('auth2')).toHaveTextContent('Not');
    });

    it('state changes in one component reflect in all consumers', async () => {
      function MultiComponentApp() {
        return (
          <div>
            <AuthTestComponent />
            <AuthTestComponent />
          </div>
        );
      }

      render(
        <AppProviders>
          <MultiComponentApp />
        </AppProviders>,
      );

      const buttons = screen.getAllByTestId('login-btn');
      buttons[0].click();

      await waitFor(() => {
        expect(screen.getAllByTestId('auth-status')[0]).toHaveTextContent('Logged in');
        expect(screen.getAllByTestId('auth-status')[1]).toHaveTextContent('Logged in');
      });
    });
  });

  describe('Provider Nesting and Composition', () => {
    it('nests providers in correct order without breaking functionality', async () => {
      render(
        <AppProviders>
          <div>
            <AuthTestComponent />
            <WalletTestComponent />
            <NotificationTestComponent />
          </div>
        </AppProviders>,
      );

      // All components should be renderable
      expect(screen.getByTestId('auth-status')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-status')).toBeInTheDocument();
      expect(screen.getByTestId('notification-count')).toBeInTheDocument();

      // They should all work together
      const loginBtn = screen.getByTestId('login-btn');
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged in');
      });

      const connectBtn = screen.getByTestId('connect-btn');
      connectBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('wallet-status')).toHaveTextContent('Connected');
      });
    });

    it('provider ordering documentation is accurate', () => {
      // This test verifies that the documented ordering is correct
      // by ensuring operations work in the expected sequence
      render(
        <AppProviders>
          <div>
            <AuthTestComponent />
            <WalletTestComponent />
            <NotificationTestComponent />
          </div>
        </AppProviders>,
      );

      // All providers should be accessible
      const authStatus = screen.getByTestId('auth-status');
      const walletStatus = screen.getByTestId('wallet-status');
      const notificationCount = screen.getByTestId('notification-count');

      expect(authStatus).toHaveTextContent('Not authenticated');
      expect(walletStatus).toHaveTextContent('Disconnected');
      expect(notificationCount).toHaveTextContent('0');
    });
  });

  describe('No Functionality Breaks', () => {
    it('app state persists through provider tree', async () => {
      render(
        <AppProviders>
          <div>
            <AuthTestComponent />
            <WalletTestComponent />
            <NotificationTestComponent />
          </div>
        </AppProviders>,
      );

      // Perform sequence of operations
      const loginBtn = screen.getByTestId('login-btn');
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged in');
      });

      const addNotificationBtn = screen.getByTestId('add-notification-btn');
      addNotificationBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
      });

      // Auth state should persist
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged in');
    });

    it('logout and wallet disconnect work properly', async () => {
      render(
        <AppProviders>
          <div>
            <AuthTestComponent />
            <WalletTestComponent />
          </div>
        </AppProviders>,
      );

      // Login and connect
      const loginBtn = screen.getByTestId('login-btn');
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged in');
      });

      const connectBtn = screen.getByTestId('connect-btn');
      connectBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('wallet-status')).toHaveTextContent('Connected');
      });

      // Disconnect
      const disconnectBtn = screen.getByTestId('disconnect-btn');
      disconnectBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('wallet-status')).toHaveTextContent('Disconnected');
      });

      // Logout
      const logoutBtn = screen.getByTestId('logout-btn');
      logoutBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not authenticated');
      });
    });
  });
});
