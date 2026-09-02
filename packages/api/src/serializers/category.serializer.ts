import type { Category } from '@prisma/client'

import { BaseSerializer } from './base.serializer.js'

export type SerializedCategory = Pick<Category, 'id' | 'name' | 'description' | 'icon' | 'createdAt' | 'updatedAt'>

export class CategorySerializer extends BaseSerializer<Category, SerializedCategory> {
  serialize(category: Category): SerializedCategory {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }
  }
}

export const categorySerializer = new CategorySerializer()
