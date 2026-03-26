import type { Request, Response } from 'express'
import * as workerService from '../services/worker.service.js'
import { handleError } from '../utils/handleError.js'
import { WorkerResource, WorkerCollection } from '../resources/index.js'
import type { CreateWorkerBody, UpdateWorkerBody, WorkerQuery } from '../interfaces/index.js'

export async function listWorkers(req: Request<{}, {}, {}, WorkerQuery>, res: Response) {
  try {
    const { category, page = '1', limit = '20', search, city, state, country } = req.query
    const { data, meta } = await workerService.listWorkers({
      category,
      page: Number(page),
      limit: Number(limit),
      search,
      city,
      state,
      country
    })
    return res.json({
      data: WorkerCollection(data as any),
      meta,
      status: 'success',
      code: 200
    })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function showWorker(req: Request, res: Response) {
  try {
    const worker = await workerService.getWorker(req.params.id as string)
    if (!worker) {
      return res.status(404).json({ status: 'error', message: 'Worker not found', code: 404 })
    }
    return res.json({ data: WorkerResource(worker as any), status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function createWorker(req: Request<{}, {}, CreateWorkerBody>, res: Response) {
  try {
    const worker = await workerService.createWorker(req.body, req.user!.id)
    return res.status(201).json({
      data: WorkerResource(worker as any),
      status: 'success',
      code: 201
    })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function updateWorker(req: Request<{ id: string }, {}, UpdateWorkerBody>, res: Response) {
  try {
    const worker = await workerService.updateWorker(req.params.id, req.body)
    return res.json({
      data: WorkerResource(worker as any),
      status: 'success',
      code: 200
    })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function deleteWorker(req: Request, res: Response) {
  try {
    await workerService.deleteWorker(req.params.id as string)
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}

export async function toggleActivation(req: Request, res: Response) {
  try {
    const updated = await workerService.toggleWorker(req.params.id as string)
    return res.json({
      data: WorkerResource(updated as any),
      status: 'success',
      code: 200
    })
  } catch (err) {
    return handleError(res, err)
  }
}
