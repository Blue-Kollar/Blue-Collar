import { beforeAll, afterAll, afterEach } from "vitest";
import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

// Prefer TEST_DATABASE_URL only when it is a valid postgres URL.
const testDbUrl = process.env.TEST_DATABASE_URL;
const baseDbUrl = process.env.DATABASE_URL;

const isValidPostgresUrl = (value?: string) => {
  if (!value) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
};

process.env.DATABASE_URL = isValidPostgresUrl(testDbUrl)
  ? testDbUrl
  : baseDbUrl;

if (!process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL is missing");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  transactionOptions: {
    maxWait: 15_000,
    timeout: 30_000,
  },
});

beforeAll(async () => {
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit" });
});

afterEach(async () => {
  // Delete in FK-safe order: dependents before parents
  await db.$transaction([
    db.booking.deleteMany(),
    db.worker.deleteMany(),
    db.user.deleteMany(),
    db.category.deleteMany(),
    db.location.deleteMany(),
  ]);
});

afterAll(async () => {
  await db.$disconnect();
});

export { db };
