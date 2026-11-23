export * from './auth.interface.js'
export * from './worker.interface.js'
export * from './response.interface.js'
export * from './repository.interface.js'

// Status enums imported directly from @bluecollar/types (single source of truth).
// Issue #1894: The *Type aliases below are deprecated — import JobStatus,
// BookingStatus, ApplicationStatus directly from @bluecollar/types instead.
export {
  JobStatus,
  BookingStatus,
  ApplicationStatus,
  // @deprecated — use JobStatus directly from @bluecollar/types
  JobStatus as JobStatusType,
  // @deprecated — use BookingStatus directly from @bluecollar/types
  BookingStatus as BookingStatusType,
  // @deprecated — use ApplicationStatus directly from @bluecollar/types
  ApplicationStatus as ApplicationStatusType,
} from '@bluecollar/types'

export type {
  PaginatedResponse,
} from '@bluecollar/types'