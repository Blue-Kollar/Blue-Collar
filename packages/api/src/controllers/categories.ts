import type { Request, Response } from 'express'
import * as categoryService from '../services/category.service.js'
import { handleError } from '../utils/handleError.js'
import { CategoryResource, CategoryCollection } from '../resources/index.js'
import { ErrorMessages, HttpStatus } from '../constants/index.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { createPaginationHelper } from '../utils/pagination.js'

export async function listCategories(req: Request, res: Response) {
  try {
    const { page, limit, skip, take, buildMeta } = createPaginationHelper(req.query, {
      maxLimit: 100,
      defaultLimit: 20,
    })

    const [categories, total] = await categoryService.listCategoriesWithPagination(skip, take)
    return sendSuccess(res, {
      ...CategoryCollection(categories as any),
      meta: buildMeta(total),
    })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getCategory(req: Request, res: Response) {
  try {
    const category = await categoryService.getCategory(req.params.id as string)
    if (!category) {
      return sendError(res, ErrorMessages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND)
    }
    return sendSuccess(res, CategoryResource(category as any))
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * POST /api/categories — admin only.
 */
export async function createCategory(req: Request, res: Response) {
  try {
    const category = await categoryService.createCategory(req.body)
    return res.status(201).json({ data: CategoryResource(category as any), status: 'success', code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * PUT /api/categories/:id — admin only.
 */
export async function updateCategory(req: Request, res: Response) {
  try {
    const category = await categoryService.updateCategory(req.params.id as string, req.body)
    return res.json({ data: CategoryResource(category as any), status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * DELETE /api/categories/:id — admin only.
 */
export async function deleteCategory(req: Request, res: Response) {
  try {
    await categoryService.deleteCategory(req.params.id as string)
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}
