import type { Review, User } from '@prisma/client'
import { BaseSerializer } from './base.serializer.js'
import { userSerializer, type SerializedUser } from './user.serializer.js'

type ReviewWithAuthor = Review & { author?: User | null }

export type SerializedReview = Review & { author?: SerializedUser }

/**
 * Escapes HTML special characters so that any legacy, unsanitised free-text
 * content (e.g. a review comment containing a script-tag payload) is
 * neutralised on display rather than being rendered as markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export class ReviewSerializer extends BaseSerializer<ReviewWithAuthor, SerializedReview> {
  serialize(review: ReviewWithAuthor): SerializedReview {
    const { author, ...rest } = review
    return {
      ...rest,
      ...(typeof rest.comment === 'string' ? { comment: escapeHtml(rest.comment) } : {}),
      ...this.embed('author', author, userSerializer),
    }
  }
}

export const reviewSerializer = new ReviewSerializer()