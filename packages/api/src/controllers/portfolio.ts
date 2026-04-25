import type { Request, Response } from 'express'
import { db } from '../db.js'

export async function listPortfolio(req: Request, res: Response) {
  const items = await db.portfolioItem.findMany({
    where: { workerId: req.params.workerId },
    orderBy: { order: 'asc' },
  })
  return res.json({ data: items, status: 'success', code: 200 })
}

export async function addPortfolioItem(req: Request, res: Response) {
  const { workerId } = req.params
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) return res.status(404).json({ status: 'error', message: 'Worker not found', code: 404 })

  const { description, order } = req.body
  const imageUrl = (req.file as Express.Multer.File & { path?: string })?.path ?? req.body.imageUrl
  if (!imageUrl) return res.status(400).json({ status: 'error', message: 'imageUrl is required', code: 400 })

  const item = await db.portfolioItem.create({
    data: { workerId, imageUrl, description, order: order ? Number(order) : 0 },
  })
  return res.status(201).json({ data: item, status: 'success', code: 201 })
}

export async function updatePortfolioItem(req: Request, res: Response) {
  const { workerId, id } = req.params
  const existing = await db.portfolioItem.findFirst({ where: { id, workerId } })
  if (!existing) return res.status(404).json({ status: 'error', message: 'Not found', code: 404 })

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
}

export async function deletePortfolioItem(req: Request, res: Response) {
  const { workerId, id } = req.params
  const existing = await db.portfolioItem.findFirst({ where: { id, workerId } })
  if (!existing) return res.status(404).json({ status: 'error', message: 'Not found', code: 404 })
  await db.portfolioItem.delete({ where: { id } })
  return res.status(204).send()
}

export async function reorderPortfolio(req: Request, res: Response) {
  // body: { items: [{ id, order }] }
  const { items } = req.body as { items: { id: string; order: number }[] }
  if (!Array.isArray(items)) return res.status(400).json({ status: 'error', message: 'items array required', code: 400 })

  await Promise.all(
    items.map(({ id, order }) => db.portfolioItem.update({ where: { id }, data: { order } })),
  )
  return res.json({ status: 'success', message: 'Order updated', code: 200 })
}
