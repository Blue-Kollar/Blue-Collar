import { notFound } from "next/navigation";

export default function DashboardErrorTestPage(): never {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  throw new Error("E2E forced dashboard segment error");
}
