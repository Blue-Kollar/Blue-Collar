import type { Review, User } from '@prisma/client'

import { BaseSerializer } from './base.serializer.js'
import { type SerializedUser,userSerializer } from './user.serializer.js'

type ReviewWithAuthor = Review & { author?: User | null }

export type SerializedReview = Review & { author?: SerializedUser }

export class ReviewSerializer extends BaseSerializer<ReviewWithAuthor, SerializedReview> {
  serialize(review: ReviewWithAuthor): SerializedReview {
    const { author, ...rest } = review
    return {
      ...rest,
      ...(author ? { author: userSerializer.serialize(author) } : {}),
    }
  }
}

export const reviewSerializer = new ReviewSerializer()
