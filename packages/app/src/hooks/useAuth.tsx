// Re-export from the canonical AuthContext for backwards compatibility.
// New code should import directly from @/context/AuthContext.
export { useAuth, AuthProvider } from "@/context/AuthContext";
export type { AuthUser } from "@/context/AuthContext";
