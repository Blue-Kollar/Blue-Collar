import { faker } from "@faker-js/faker";
import type { Category } from "../types";

export const categoryFactory = (
  overrides: Partial<Category> = {},
): Category => {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.department(),
    description: faker.commerce.productDescription(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};
