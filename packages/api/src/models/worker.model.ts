import type { Worker, Category, User } from '@prisma/client';

type WorkerWithRelations = Worker & {
  category: Category;
  curator: User;
};

export function formatWorker(worker: WorkerWithRelations) {
  const { curatorId, categoryId, ...rest } = worker;
  return {
    ...rest,
    category: { id: worker.category.id, name: worker.category.name },
    curator: {
      id: worker.curator.id,
      firstName: worker.curator.firstName,
      lastName: worker.curator.lastName,
      avatar: worker.curator.avatar,
    },
  };
}
