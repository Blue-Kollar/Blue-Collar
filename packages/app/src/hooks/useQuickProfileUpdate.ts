import { useMutation } from "@tanstack/react-query";

export interface QuickProfileData {
  firstName: string;
  lastName: string;
  email: string;
}

export function useQuickProfileUpdate(token: string) {
  return useMutation({
    mutationFn: async (data: QuickProfileData) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"}/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save");
      return data;
    },
  });
}