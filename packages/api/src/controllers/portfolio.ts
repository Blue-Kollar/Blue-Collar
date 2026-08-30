import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { ErrorMessages } from '../constants/errors.js'
import { db } from '../db.js'

export const listPortfolio = catchAsync(async (req: Request, res: Response) => {
  const items = await db.portfolioItem.findMany({
    where: { workerId: req.params.workerId },
    orderBy: { order: 'asc' },
  })
  return res.json({ data: items, status: 'success', code: 200 })
})

export const addPortfolioItem = catchAsync(async (req: Request, res: Response) => {
  const { workerId } = req.params
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) {
    throw new AppError(ErrorMessages.WORKER_NOT_FOUND, 404, true, ErrorCode.NOT_FOUND)
  }

  const { description, order } = req.body
  const imageUrl = (req.file as Express.Multer.File & { path?: string })?.path ?? req.body.imageUrl
  if (!imageUrl) {
    throw new AppError('imageUrl is required', 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const item = await db.portfolioItem.create({
    data: { workerId, imageUrl, description, order: order ? Number(order) : 0 },
  })
  return res.status(201).json({ data: item, status: 'success', code: 201 })
})

export const updatePortfolioItem = catchAsync(async (req: Request, res: Response) => {
  const { workerId, id } = req.params
  const existing = await db.portfolioItem.findFirst({ where: { id, workerId } })
  if (!existing) {
    throw new AppError(ErrorMessages.NOT_FOUND, 404, true, ErrorCode.NOT_FOUND)
  }

  const { description, order } = req.body
  const imageUrl = (req.file as Express.Multer.File & { path?: string })?.path ?? req.body.imageUrl

  const item = await db.portfolioItem.update({
    where: { id },
    data: {
      ...(imageUrl ? { imageUrl } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(order !== undefined ? { order: Number(order) } : {}),
    },
  })
  return res.json({ data: item, status: 'success', code: 200 })
})

export const deletePortfolioItem = catchAsync(async (req: Request, res: Response) => {
  const { workerId, id } = req.params
  const existing = await db.portfolioItem.findFirst({ where: { id, workerId } })
  if (!existing) {
    throw new AppError(ErrorMessages.NOT_FOUND, 404, true, ErrorCode.NOT_FOUND)
  }
  await db.portfolioItem.delete({ where: { id } })
  return res.status(204).send()
})

export const reorderPortfolio = catchAsync(async (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: string; order: number }[] }
  if (!Array.isArray(items)) {
    throw new AppError('items array required', 400, true, ErrorCode.VALIDATION_ERROR)
  }

  await Promise.all(
    items.map(({ id, order }) => db.portfolioItem.update({ where: { id }, data: { order } })),
  )
  return res.json({ status: 'success', message: 'Order updated', code: 200 })
})
