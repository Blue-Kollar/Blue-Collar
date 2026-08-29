/**
 * Business Metrics Recorder
 *
 * Records business-relevant events to Prometheus metrics.
 * Integrate with services to track worker registrations, payments, user growth, etc.
 */

import {
  recordWorkerRegistration,
  setActiveWorkers,
  recordTip,
  setUsersTotal,
  setUsersVerified,
  recordReview,
  recordContractRegistration,
  recordContractTransaction,
} from '../middleware/metrics.js'
import { db } from '../db.js'
import { logger } from '../config/logger.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'

class BusinessMetricsRecorder {
  /**
   * Sync worker metrics from database to Prometheus
   */
  async syncWorkerMetrics() {
    try {
      const activeCount = await db.worker.count({
        where: { isActive: true },
      })
      setActiveWorkers(activeCount)
    } catch (err) {
      logger.error(`Failed to sync worker metrics: ${getErrorMessage(err)}`)
    }
  }

  /**
   * Sync user metrics from database to Prometheus
   */
  async syncUserMetrics() {
    try {
      const totalCount = await db.user.count()
      const verifiedCount = await db.user.count({
        where: { verified: true },
      })

      setUsersTotal(totalCount, 'all')
      setUsersVerified(verifiedCount, 'all')

      // By role
      const roleStats = await db.user.groupBy({
        by: ['role'],
        _count: true,
      })

      for (const stat of roleStats) {
        setUsersTotal(stat._count, stat.role)

        const verifiedByRole = await db.user.count({
          where: { role: stat.role, verified: true },
        })
        setUsersVerified(verifiedByRole, stat.role)
      }
    } catch (err) {
      logger.error(`Failed to sync user metrics: ${getErrorMessage(err)}`)
    }
  }

  /**
   * Record worker registration event
   */
  recordWorkerCreated(category: string) {
    try {
      recordWorkerRegistration(category, 'success')
    } catch (err) {
      logger.error(`Failed to record worker registration: ${getErrorMessage(err)}`)
    }
  }

  /**
   * Record payment/tip event
   */
  recordPayment(amount: number, currency: string = 'XLM', usdValue: number = 0) {
    try {
      recordTip(amount, currency, usdValue)
    } catch (err) {
      logger.error(`Failed to record payment metric: ${getErrorMessage(err)}`)
    }
  }

  /**
   * Record review creation
   */
  recordReviewCreated(rating: number, category: string = 'all') {
    try {
      recordReview(rating, category)
    } catch (err) {
      logger.error(`Failed to record review metric: ${getErrorMessage(err)}`)
    }
  }

  /**
   * Record contract registration attempt
   */
  recordContractRegistrationAttempt(success: boolean) {
    try {
      recordContractRegistration(success ? 'success' : 'failure')
    } catch (err) {
      logger.error(`Failed to record contract registration metric: ${getErrorMessage(err)}`)
    }
  }

  /**
   * Record contract transaction
   */
  recordContractTx(type: string, success: boolean, gasUsed?: number) {
    try {
      recordContractTransaction(type, success ? 'success' : 'failure', gasUsed)
    } catch (err) {
      logger.error(`Failed to record contract transaction metric: ${getErrorMessage(err)}`)
    }
  }

  /**
   * Start periodic sync of gauge metrics (aggregates that change based on database state)
   * Run every 5 minutes to keep metrics fresh
   */
  startPeriodicSync() {
    setInterval(() => {
      this.syncWorkerMetrics()
      this.syncUserMetrics()
    }, 5 * 60 * 1000) // 5 minutes
  }
}

export const metricsRecorder = new BusinessMetricsRecorder()
