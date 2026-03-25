"use client";

import { useState, useEffect, createContext, useContext } from "react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "user" | "curator" | "admin";
}

interface AuthContextValue {
  user: User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({ user: null, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Replace with real session fetch
    const stored = localStorage.getItem("bc_user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const logout = () => {
    localStorage.removeItem("bc_user");
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
