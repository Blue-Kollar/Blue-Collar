import { faker } from "@faker-js/faker";
import type { User } from "../types";

export const userFactory = (overrides: Partial<User> = {}): User => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    id: faker.string.uuid(),
    email: faker.internet.email({ firstName, lastName }),
    firstName,
    lastName,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};
