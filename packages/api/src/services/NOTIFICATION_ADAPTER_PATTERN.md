# Notification Channels Adapter Pattern

## Overview

This document describes the adapter pattern implementation for the notification system, which decouples notification delivery channels (email, push, in-app) from the core notification service.

## Architecture

### Core Interfaces

**`NotificationChannel`** - Adapter interface that all notification channels must implement:
- `name`: Unique identifier for the channel (e.g., 'email', 'push', 'inapp')
- `shouldSend(message, prefs)`: Determines if the channel should deliver based on user preferences
- `send(message)`: Executes the delivery and returns delivery status

**`NotificationMessage`** - Normalized message format passed to channels:
- `userId`, `type`, `title`, `message`, `href`, `data`

**`DeliveryResult`** - Result of a delivery attempt:
- `channel`, `status`, `error`, `sentAt`

### Channel Implementations

1. **InAppChannel** - Creates notification records in the database
   - Always sends (no preference gating)
   - Core delivery mechanism

2. **EmailChannel** - Sends email notifications
   - Gated on type-specific preferences (e.g., 'system' → announcements)
   - Routes through mailer service

3. **PushChannel** - Sends web push notifications
   - Gated on type-specific preferences (e.g., 'review' → reviewReply)
   - Routes through push service (VAPID)

### Channel Registry

**`ChannelRegistry`** - Manages available notification channels:
- Registers channels at startup
- Retrieves channels by name
- Supports dependency injection for testing

## Service Flow

```
dispatchNotification(payload)
  ↓
1. Create in-app notification record
2. Get requested channels from registry
3. For each channel:
   a. Check if channel.shouldSend() passes
   b. Call channel.send()
   c. Collect delivery result/status
4. Store delivery logs
```

## Design Benefits

### 1. Separation of Concerns
Each channel encapsulates its own delivery logic, preference gating, and error handling. Changes to one channel don't affect others.

### 2. Testability
- Channels can be mocked/stubbed independently
- No need to mock mailer, push service, or DB for each test
- Unit tests provide fake channel implementations

### 3. Extensibility
Adding a new notification channel requires no changes to the core service:
```typescript
class SMSChannel implements NotificationChannel {
  readonly name = 'sms'
  
  shouldSend(message, prefs) {
    return prefs['sms'] ?? true
  }
  
  async send(message) {
    // SMS delivery logic
  }
}

// Register the channel
registry.register(new SMSChannel())
```

### 4. Backward Compatibility
The module-level `dispatchNotification()` export remains unchanged:
```typescript
// This still works for existing code
import { dispatchNotification } from '@/services/notification.service.js'
await dispatchNotification({ userId, type, title, message })
```

## Testing Strategy

### Unit Tests
- Mock channels using `FakeEmailChannel`, `FakePushChannel`, `FakeInAppChannel`
- Test preference gating logic per channel
- Test deduplication, error resilience, and delivery logs
- Test custom channel registration (adapter isolation)

### Integration Tests
- E2E tests verify preference changes are respected
- Tests confirm channels are selectively called based on preferences
- Tests verify delivery logs are properly recorded

## Acceptance Criteria Fulfilled

✅ **Adding a channel needs no change to the core service**
- Implement `NotificationChannel` interface
- Register with `ChannelRegistry`
- Service automatically routes to new channel

✅ **Tested (unit with fake channel)**
- Fake channel implementations for testing
- All scenarios covered without external dependencies
- Custom channel test demonstrates extensibility

✅ **Code review ready**
- Clear separation of concerns
- Type-safe implementations
- Comprehensive test coverage
- Backward compatible

✅ **Related tests passing**
- Unit tests updated for adapter pattern
- Integration tests unaffected (E2E still works)
- Regression tests unaffected (module export preserved)

## File Structure

```
packages/api/src/services/
├── channels/
│   ├── NotificationChannel.ts      # Interface definitions
│   ├── EmailChannel.ts              # Email adapter
│   ├── PushChannel.ts               # Push adapter
│   ├── InAppChannel.ts              # In-app adapter
│   ├── ChannelRegistry.ts           # Channel manager
│   └── index.ts                     # Exports
├── notification.service.ts          # Refactored service
└── notification.service.test.ts     # Updated tests
```

## Migration Path

Existing code continues to work as-is:
```typescript
// Old API (still works)
import { dispatchNotification } from '@/services/notification.service.js'

// New API (with dependency injection)
import { createNotificationService, ChannelRegistry } from '@/services/notification.service.js'
const registry = new ChannelRegistry()
const service = createNotificationService({ notificationRepository, channelRegistry: registry })
```

## Future Enhancements

1. **SMS Channel** - Add SMS delivery (Twilio/AWS SNS)
2. **Slack Channel** - Integration with workspace notifications
3. **Custom Channel API** - Allow users to register custom channels at runtime
4. **Channel Scheduling** - Respect quiet hours per channel
5. **Retry Policies** - Per-channel retry strategies
