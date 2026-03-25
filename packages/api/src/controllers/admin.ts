import type { Request, Response } from 'express'
import { paginate } from '../utils/paginate.js'

export async function listWorkers(req: Request, res: Response) {
  const { page = '1', limit = '20' } = req.query
  const { data, meta } = await paginate({
    model: 'worker',
    include: { category: true, curator: true },
    page: Number(page),
    limit: Number(limit),
  })
  return res.json({ data, meta, status: 'success', code: 200 })
}

export async function listUsers(req: Request, res: Response) {
  const { page = '1', limit = '20' } = req.query
  const { data, meta } = await paginate({
    model: 'user',
    page: Number(page),
    limit: Number(limit),
  })
  return res.json({ data, meta, status: 'success', code: 200 })
}
