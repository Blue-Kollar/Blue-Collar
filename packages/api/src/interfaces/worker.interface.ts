export interface CreateWorkerBody {
  name: string
  categoryId: string
  phone?: string
  email?: string
  bio?: string
  avatar?: string
  walletAddress?: string
  locationId?: string
}

export interface UpdateWorkerBody extends Partial<CreateWorkerBody> {}

export interface WorkerQuery {
  category?: string
  search?: string
  lang?: string        // PostgreSQL regconfig language for FTS (default: 'simple')
  city?: string
  state?: string
  country?: string
  page?: string
  limit?: string
  minRating?: string   // minimum average rating (1-5)
  available?: string   // day of week 0-6
  listedSince?: string // max years since listing (experience proxy)
}
