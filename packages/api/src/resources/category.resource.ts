import type { Category } from '@prisma/client'

export function CategoryResource(category: Category) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    icon: category.icon,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }
}

export function CategoryCollection(categories: Category[]) {
  return categories.map(CategoryResource)
}
