import { Router } from 'express'
import { getMyReferralCode, applyReferralCode, getMyReferralStats, getLeaderboard, rewardReferral } from '../controllers/referral.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.get('/my/code', authenticate, getMyReferralCode)
router.post('/apply', authenticate, applyReferralCode)
router.get('/my/stats', authenticate, getMyReferralStats)
router.get('/leaderboard', getLeaderboard)
router.patch('/:id/reward', authenticate, authorize('admin'), rewardReferral)

export default router
