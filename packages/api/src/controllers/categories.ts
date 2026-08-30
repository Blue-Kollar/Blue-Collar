import type { Request, Response } from 'express'
import * as categoryService from '../services/category.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { CategoryResource, CategoryCollection } from '../resources/index.js'
import { ErrorMessages, HttpStatus } from '../constants/index.js'
import { sendSuccess } from '../utils/response.js'
import { createPaginationHelper } from '../utils/pagination.js'

export const listCategories = catchAsync(async (req: Request, res: Response) => {
  const { skip, take, buildMeta } = createPaginationHelper(req.query, {
    maxLimit: 100,
    defaultLimit: 20,
  })

  const [categories, total] = await categoryService.listCategoriesWithPagination(skip, take)
  return sendSuccess(res, {
    ...CategoryCollection(categories),
    meta: buildMeta(total),
  })
})

export const getCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.getCategory(req.params.id as string)
  if (!category) {
    throw new AppError(ErrorMessages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND, true, ErrorCode.NOT_FOUND)
  }
  return sendSuccess(res, CategoryResource(category))
})

/**
 * POST /api/categories — admin only.
 */
export const createCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body)
  return res.status(201).json({ data: CategoryResource(category), status: 'success', code: 201 })
})

/**
 * PUT /api/categories/:id — admin only.
 */
export const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(req.params.id as string, req.body)
  return res.json({ data: CategoryResource(category), status: 'success', code: 200 })
})

/**
 * DELETE /api/categories/:id — admin only.
 */
export const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(req.params.id as string)
  return res.status(204).send()
})
