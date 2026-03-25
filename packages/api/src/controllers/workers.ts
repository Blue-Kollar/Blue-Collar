import type { Request, Response } from 'express'
import { db } from '../db.js'

export async function listWorkers(req: Request, res: Response) {
  const { category, location, search, page = '1', limit = '20' } = req.query
  const where = {
    isActive: true,
    ...(category ? { categoryId: String(category) } : {}),
    ...(search ? { name: { contains: String(search), mode: 'insensitive' as const } } : {}),
  }
  const [workers, total] = await Promise.all([
    db.worker.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { category: true },
    }),
    db.worker.count({ where }),
  ])
  return res.json({
    data: workers,
    meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    status: 'success',
    code: 200,
  })
}

export async function showWorker(req: Request, res: Response) {
  const worker = await db.worker.findUnique({
    where: { id: req.params.id },
    include: { category: true },
  })
  if (!worker) return res.status(404).json({ status: 'error', message: 'Not found', code: 404 })
  return res.json({ data: worker, status: 'success', code: 200 })
}

export async function createWorker(req: Request, res: Response) {
  const worker = await db.worker.create({ data: { ...req.body, curatorId: req.user!.id } })
  return res.status(201).json({ data: worker, status: 'success', code: 201 })
}

/** Returns the worker or sends a 404. Also enforces curator ownership unless the caller is an admin. */
async function resolveWorker(req: Request, res: Response) {
  const worker = await db.worker.findUnique({ where: { id: req.params.id } })
  if (!worker) {
    res.status(404).json({ status: 'error', message: 'Not found', code: 404 })
    return null
  }
  if (req.user!.role !== 'admin' && worker.curatorId !== req.user!.id) {
    res.status(403).json({ status: 'error', message: 'Forbidden', code: 403 })
    return null
  }
  return worker
}

export async function updateWorker(req: Request, res: Response) {
  const worker = await resolveWorker(req, res)
  if (!worker) return
  const updated = await db.worker.update({ where: { id: worker.id }, data: req.body })
  return res.json({ data: updated, status: 'success', code: 200 })
}

export async function deleteWorker(req: Request, res: Response) {
  const worker = await resolveWorker(req, res)
  if (!worker) return
  await db.worker.delete({ where: { id: worker.id } })
  return res.status(204).send()
}

export async function toggleActivation(req: Request, res: Response) {
  const worker = await resolveWorker(req, res)
  if (!worker) return
  const updated = await db.worker.update({
    where: { id: worker.id },
    data: { isActive: !worker.isActive },
  })
  return res.json({ data: updated, status: 'success', code: 200 })
}
