import { EventEmitter } from 'node:events'

import type { AppEventName,AppEvents } from './event-types.js'

/**
 * Type-safe wrapper around Node's EventEmitter.
 * Provides `emit`, `on`, and `off` with full payload inference.
 */
class AppEventEmitter {
  private emitter = new EventEmitter()

  on<E extends AppEventName>(event: E, listener: (payload: AppEvents[E]) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  off<E extends AppEventName>(event: E, listener: (payload: AppEvents[E]) => void): this {
    this.emitter.off(event, listener)
    return this
  }

  once<E extends AppEventName>(event: E, listener: (payload: AppEvents[E]) => void): this {
    this.emitter.once(event, listener)
    return this
  }

  emit<E extends AppEventName>(event: E, payload: AppEvents[E]): boolean {
    return this.emitter.emit(event, payload)
  }
}

/** Singleton event bus — import this wherever you need to emit or listen. */
export const appEvents = new AppEventEmitter()
