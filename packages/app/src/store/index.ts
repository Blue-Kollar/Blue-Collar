import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'guest';
}

export interface Session {
  token: string | null;
  expiresAt: number | null;
}

export interface AuthState {
  user: User | null;
  session: Session;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  error: string | null;
}

export interface AuthActions {
  setUser: (user: User | null) => void;
  setSession: (session: Partial<Session>) => void;
  setStatus: (status: AuthState['status']) => void;
  setError: (error: string | null) => void;
  login: (user: User, session: Session) => void;
  logout: () => void;
  reset: () => void;
}

export type AuthSlice = AuthState & AuthActions;

export interface WalletState {
  address: string | null;
  chainId: number | null;
  balance: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export interface WalletActions {
  setAddress: (address: string | null) => void;
  setChainId: (chainId: number | null) => void;
  setBalance: (balance: string | null) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  connect: (address: string, chainId: number) => void;
  disconnect: () => void;
  reset: () => void;
}

export type WalletSlice = WalletState & WalletActions;

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  createdAt: number;
  read: boolean;
}

export interface NotificationsState {
  items: Notification[];
}

export interface NotificationsActions {
  addNotification: (
    notification: Omit<Notification, 'id' | 'createdAt' | 'read'> & {
      id?: string;
      createdAt?: number;
    },
  ) => string;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  reset: () => void;
}

export type NotificationsSlice = NotificationsState & NotificationsActions;

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UIPreferencesState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  language: string;
  reducedMotion: boolean;
}

export interface UIPreferencesActions {
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setLanguage: (language: string) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  reset: () => void;
}

export type UIPreferencesSlice = UIPreferencesState & UIPreferencesActions;

export type AppStore = AuthSlice & WalletSlice & NotificationsSlice & UIPreferencesSlice;

/* -------------------------------------------------------------------------- */
/*                              Initial states                                */
/* -------------------------------------------------------------------------- */

export const initialAuthState: AuthState = {
  user: null,
  session: { token: null, expiresAt: null },
  status: 'idle',
  error: null,
};

export const initialWalletState: WalletState = {
  address: null,
  chainId: null,
  balance: null,
  connected: false,
  connecting: false,
  error: null,
};

export const initialNotificationsState: NotificationsState = {
  items: [],
};

export const initialUIPreferencesState: UIPreferencesState = {
  theme: 'system',
  sidebarCollapsed: false,
  language: 'en',
  reducedMotion: false,
};

/* -------------------------------------------------------------------------- */
/*                                  Slices                                    */
/* -------------------------------------------------------------------------- */

let notificationCounter = 0;

const createNotificationId = (): string => {
  notificationCounter += 1;
  return `notification-${Date.now()}-${notificationCounter}`;
};

export const createAuthSlice = (
  set: (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void,
): AuthSlice => ({
  ...initialAuthState,
  setUser: (user) => set({ user }),
  setSession: (session) =>
    set((state) => ({ session: { ...state.session, ...session } })),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  login: (user, session) =>
    set({
      user,
      session,
      status: 'authenticated',
      error: null,
    }),
  logout: () =>
    set({
      user: null,
      session: { token: null, expiresAt: null },
      status: 'unauthenticated',
      error: null,
    }),
  reset: () => set({ ...initialAuthState }),
});

export const createWalletSlice = (
  set: (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void,
): WalletSlice => ({
  ...initialWalletState,
  setAddress: (address) => set({ address }),
  setChainId: (chainId) => set({ chainId }),
  setBalance: (balance) => set({ balance }),
  setConnecting: (connecting) => set({ connecting }),
  setError: (error) => set({ error }),
  connect: (address, chainId) =>
    set({
      address,
      chainId,
      connected: true,
      connecting: false,
      error: null,
    }),
  disconnect: () =>
    set({
      address: null,
      chainId: null,
      balance: null,
      connected: false,
      connecting: false,
      error: null,
    }),
  reset: () => set({ ...initialWalletState }),
});

export const createNotificationsSlice = (
  set: (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void,
): NotificationsSlice => ({
  ...initialNotificationsState,
  addNotification: (notification) => {
    const id = notification.id ?? createNotificationId();
    const createdAt = notification.createdAt ?? Date.now();
    set((state) => ({
      items: [
        ...state.items,
        {
          id,
          type: notification.type,
          message: notification.message,
          title: notification.title,
          createdAt,
          read: false,
        },
      ],
    }));
    return id;
  },
  removeNotification: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  markAsRead: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    })),
  markAllAsRead: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, read: true })),
    })),
  clearNotifications: () => set({ items: [] }),
  reset: () => set({ ...initialNotificationsState }),
});

export const createUIPreferencesSlice = (
  set: (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void,
): UIPreferencesSlice => ({
  ...initialUIPreferencesState,
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setLanguage: (language) => set({ language }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  reset: () => set({ ...initialUIPreferencesState }),
});

/* -------------------------------------------------------------------------- */
/*                                   Store                                    */
/* -------------------------------------------------------------------------- */

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        ...createAuthSlice(set),
        ...createWalletSlice(set),
        ...createNotificationsSlice(set),
        ...createUIPreferencesSlice(set),
      }),
      {
        name: 'blue-collar-app-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          session: state.session,
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          language: state.language,
          reducedMotion: state.reducedMotion,
        }),
      },
    ),
    { name: 'BlueCollarAppStore' },
  ),
);

/* -------------------------------------------------------------------------- */
/*                          Typed hooks / selectors                           */
/* -------------------------------------------------------------------------- */

// Auth
export const useAuth = () => useAppStore((state) => state);
export const useUser = () => useAppStore((state) => state.user);
export const useSession = () => useAppStore((state) => state.session);
export const useAuthStatus = () => useAppStore((state) => state.status);
export const useIsAuthenticated = () =>
  useAppStore((state) => state.status === 'authenticated' && state.user !== null);
export const useAuthActions = () =>
  useAppStore((state) => ({
    setUser: state.setUser,
    setSession: state.setSession,
    setStatus: state.setStatus,
    setError: state.setError,
    login: state.login,
    logout: state.logout,
    reset: state.reset,
  }));

// Wallet
export const useWallet = () => useAppStore((state) => state);
export const useWalletAddress = () => useAppStore((state) => state.address);
export const useWalletChainId = () => useAppStore((state) => state.chainId);
export const useWalletBalance = () => useAppStore((state) => state.balance);
export const useIsWalletConnected = () => useAppStore((state) => state.connected);
export const useWalletActions = () =>
  useAppStore((state) => ({
    setAddress: state.setAddress,
    setChainId: state.setChainId,
    setBalance: state.setBalance,
    setConnecting: state.setConnecting,
    setError: state.setError,
    connect: state.connect,
    disconnect: state.disconnect,
    reset: state.reset,
  }));

// Notifications
export const useNotifications = () => useAppStore((state) => state.items);
export const useUnreadNotificationCount = () =>
  useAppStore((state) => state.items.filter((item) => !item.read).length);
export const useNotificationActions = () =>
  useAppStore((state) => ({
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
    markAsRead: state.markAsRead,
    markAllAsRead: state.markAllAsRead,
    clearNotifications: state.clearNotifications,
    reset: state.reset,
  }));

// UI preferences
export const useUIPreferences = () => useAppStore((state) => state);
export const useTheme = () => useAppStore((state) => state.theme);
export const useSidebarCollapsed = () =>
  useAppStore((state) => state.sidebarCollapsed);
export const useLanguage = () => useAppStore((state) => state.language);
export const useReducedMotion = () => useAppStore((state) => state.reducedMotion);
export const useUIPreferencesActions = () =>
  useAppStore((state) => ({
    setTheme: state.setTheme,
    toggleSidebar: state.toggleSidebar,
    setSidebarCollapsed: state.setSidebarCollapsed,
    setLanguage: state.setLanguage,
    setReducedMotion: state.setReducedMotion,
    reset: state.reset,
  }));

/* -------------------------------------------------------------------------- */
/*                          Non-hook store accessors                          */
/* -------------------------------------------------------------------------- */

export const getAppState = () => useAppStore.getState();
export const setAppState = useAppStore.setState;
export const subscribeToAppStore = useAppStore.subscribe;

export const resetAppStore = () => {
  useAppStore.setState({
    ...initialAuthState,
    ...initialWalletState,
    ...initialNotificationsState,
    ...initialUIPreferencesState,
  });
};

export default useAppStore;