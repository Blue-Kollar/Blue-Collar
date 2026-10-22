import { isNotificationEnabled, seedDefaultPreferences } from "../services/notificationPreferences.service";

jest.mock("@prisma/client", () => {
  const mockFind = jest.fn();
  const mockUpsert = jest.fn();
  const mockCreate = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      notificationPreferences: {
        findUnique: mockFind,
        upsert: mockUpsert,
        create: mockCreate,
      },
    })),
    __mockFind: mockFind,
    __mockUpsert: mockUpsert,
  };
});

const { __mockFind, __mockUpsert } = require("@prisma/client");

beforeEach(() => jest.clearAllMocks());

test("isNotificationEnabled returns true when prefs row missing", async () => {
  __mockFind.mockResolvedValue(null);
  expect(await isNotificationEnabled("user-1", "statusChange")).toBe(true);
});

test("isNotificationEnabled returns stored value when row exists", async () => {
  __mockFind.mockResolvedValue({
    newWorkerNearby: false,
    statusChange: true,
    reviewReply: true,
    announcements: false,
  });
  expect(await isNotificationEnabled("user-1", "newWorkerNearby")).toBe(false);
  expect(await isNotificationEnabled("user-1", "statusChange")).toBe(true);
});

test("isNotificationEnabled throws for unknown type", async () => {
  __mockFind.mockResolvedValue({ statusChange: true });
  await expect(isNotificationEnabled("user-1", "unknownType")).rejects.toThrow(
    "Unknown notification type: unknownType"
  );
});

test("seedDefaultPreferences calls upsert with all-enabled defaults", async () => {
  __mockUpsert.mockResolvedValue({ userId: "user-1", newWorkerNearby: true });
  await seedDefaultPreferences("user-1");
  expect(__mockUpsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { userId: "user-1" },
      create: expect.objectContaining({
        newWorkerNearby: true,
        statusChange: true,
        reviewReply: true,
        announcements: true,
      }),
    })
  );
});
