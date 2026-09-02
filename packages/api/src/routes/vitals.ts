import { Router } from 'express'

import { logger } from '../config/logger.js'

const router = Router()

router.post('/vitals', (req, res) => {
  const { name, value, rating, id } = req.body ?? {}
  logger.info({ name, value, rating, id }, 'web_vital')
  res.status(204).end()
})

export default router
