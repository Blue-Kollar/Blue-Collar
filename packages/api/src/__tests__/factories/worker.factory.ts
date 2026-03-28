import { faker } from "@faker-js/faker";
import type { Worker } from "../types";
import { userFactory } from "./user.factory";
import { categoryFactory } from "./category.factory";

export const workerFactory = (overrides: Partial<Worker> = {}): Worker => {
  const user = userFactory();
  const category = categoryFactory();

  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    categoryId: category.id,
    curatorId: user.id,
    isActive: true,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};
