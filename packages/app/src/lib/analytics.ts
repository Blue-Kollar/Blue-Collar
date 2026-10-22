// Event Taxonomy & Analytics Instrumentation
// Zero PII tracking with consent gating

type EventCategory = 'discovery' | 'profile' | 'tip' | 'review' | 'auth' | 'system'

interface AnalyticsEvent {
  event: string
  category: EventCategory
  properties?: Record<string, string | number | boolean>
  timestamp: string
}

interface ConsentState {
  analytics: boolean
  functional: boolean
  marketing: boolean
}

class Analytics {
  private consent: ConsentState = {
    analytics: false,
    functional: true,
    marketing: false,
  }

  private queue: AnalyticsEvent[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadConsent()
    }
  }

  setConsent(consent: Partial<ConsentState>) {
    this.consent = { ...this.consent, ...consent }
    if (typeof window !== 'undefined') {
      localStorage.setItem('analytics_consent', JSON.stringify(this.consent))
    }
  }

  private loadConsent() {
    const stored = localStorage.getItem('analytics_consent')
    if (stored) {
      this.consent = JSON.parse(stored)
    }
  }

  private scrubPII(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data

    // Block PII fields
    const BLOCKED = ['email', 'name', 'phone', 'address', 'ip', 'walletAddress']

    if (Array.isArray(data)) {
      return data.map((item) => (typeof item === 'object' ? this.scrubPII(item) : item))
    }

    const scrubbed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (BLOCKED.includes(key)) continue
      scrubbed[key] = typeof value === 'object' ? this.scrubPII(value) : value
    }
    return scrubbed
  }

  private track(event: string, category: EventCategory, properties?: Record<string, unknown>) {
    if (!this.consent.analytics) return

    const scrubbedProperties = this.scrubPII(properties) as AnalyticsEvent['properties']
    const analyticsEvent: AnalyticsEvent = {
      event,
      category,
      properties: scrubbedProperties,
      timestamp: new Date().toISOString(),
    }

    this.queue.push(analyticsEvent)
    this.flush()
  }

  private async flush() {
    if (this.queue.length === 0) return

    const batch = [...this.queue]
    this.queue = []

    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      })
    } catch (err) {
      console.error('Analytics flush failed', err)
    }
  }

  // Discovery funnel
  workerSearched(query: string, resultCount: number) {
    this.track('worker_searched', 'discovery', { queryLength: query.length, resultCount })
  }

  workerCategoryViewed(categoryId: string) {
    this.track('worker_category_viewed', 'discovery', { categoryId })
  }

  workerFilterApplied(filterType: string) {
    this.track('worker_filter_applied', 'discovery', { filterType })
  }

  // Profile funnel
  workerProfileViewed(workerId: string, source: string) {
    this.track('worker_profile_viewed', 'profile', { workerId, source })
  }

  workerContactClicked(workerId: string) {
    this.track('worker_contact_clicked', 'profile', { workerId })
  }

  workerBookmarked(workerId: string) {
    this.track('worker_bookmarked', 'profile', { workerId })
  }

  // Tip funnel
  tipModalOpened(workerId: string) {
    this.track('tip_modal_opened', 'tip', { workerId })
  }

  tipAmountEntered(amount: number) {
    this.track('tip_amount_entered', 'tip', { amount })
  }

  tipConfirmed(workerId: string, amount: number) {
    this.track('tip_confirmed', 'tip', { workerId, amount })
  }

  tipCompleted(workerId: string, amount: number, duration: number) {
    this.track('tip_completed', 'tip', { workerId, amount, duration })
  }

  tipFailed(workerId: string, reason: string) {
    this.track('tip_failed', 'tip', { workerId, reason })
  }

  // Review funnel
  reviewModalOpened(workerId: string) {
    this.track('review_modal_opened', 'review', { workerId })
  }

  reviewRatingSelected(rating: number) {
    this.track('review_rating_selected', 'review', { rating })
  }

  reviewSubmitted(workerId: string, rating: number) {
    this.track('review_submitted', 'review', { workerId, rating })
  }

  // Auth funnel
  loginAttempted(method: 'email' | 'google') {
    this.track('login_attempted', 'auth', { method })
  }

  loginCompleted(method: 'email' | 'google') {
    this.track('login_completed', 'auth', { method })
  }

  signupCompleted(method: 'email' | 'google') {
    this.track('signup_completed', 'auth', { method })
  }
}

export const analytics = new Analytics()
