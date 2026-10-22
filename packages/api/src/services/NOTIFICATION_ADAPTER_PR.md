# Pull Request: Notification Channels Adapter Pattern (#1639)

## Overview

Implement the adapter pattern for notification delivery channels to decouple email, push, and in-app notifications from the core service. This enables testing channels independently and adding new channels without modifying the notification service.

## Changes

### 1. Channel Adapter Interface (`src/services/channels/NotificationChannel.ts`)

Defines the contract all notification channels must implement:

```typescript
interface NotificationChannel {
  readonly name: string
  shouldSend(message: NotificationMessage, prefs: Record<string, boolean>): boolean | Promise<boolean>
  send(message: NotificationMessage): Promise<DeliveryResult>
}
```

**Key Types:**
- `NotificationMessage`: Normalized message passed to channels (userId, title, message, type, href, data)
- `DeliveryResult`: Result of delivery attempt (channel, status, error, sentAt)

### 2. Channel Implementations

#### EmailChannel (`src/services/channels/EmailChannel.ts`)
- Routes through mailer service
- Type-based preference gating (system→announcements, review→reviewReply)
- Handles user email lookup and template rendering

#### PushChannel (`src/services/channels/PushChannel.ts`)
- Routes through push service (VAPID)
- Review notifications gated on reviewReply preference
- Handles subscription management

#### InAppChannel (`src/services/channels/InAppChannel.ts`)
- Creates notification records in database
- Always sends (no preference gating)
- Core delivery mechanism

### 3. Channel Registry (`src/services/channels/ChannelRegistry.ts`)

Manages available notification channels:
- Registers channels at startup
- Retrieves channels by name
- Supports dynamic registration for testing
- Zero coupling to channel implementations

### 4. Service Refactoring (`src/services/notification.service.ts`)

Updated to route notifications through adapter pattern:
- Gets requested channels from registry
- For each channel: checks shouldSend(), calls send()
- Collects delivery results per channel
- Maintains backward compatibility with module-level exports

### 5. Test Updates (`src/services/notification.service.test.ts`)

Completely rewritten to use adapter pattern:
- **FakeEmailChannel**: Mock email with error injection
- **FakePushChannel**: Mock push with error injection
- **FakeInAppChannel**: Mock database persistence
- Tests verify:
  - Channel isolation
  - Preference gating per channel
  - Deduplication
  - Error resilience
  - Custom channel registration

### 6. Documentation (`src/services/NOTIFICATION_ADAPTER_PATTERN.md`)

Complete architecture guide including:
- Design patterns and separation of concerns
- How to add new notification channels
- Testing strategy
- Backward compatibility notes
- Future enhancement ideas

## Design Benefits

### 1. Separation of Concerns
Each channel encapsulates its own:
- Delivery logic
- Preference gating
- Error handling
- Configuration

Changes to one channel don't affect others.

### 2. Testability
- Channels can be mocked/stubbed independently
- No need to mock mailer, push service, or DB for each test
- Unit tests provide fake channel implementations
- Custom channel test demonstrates extensibility

### 3. Extensibility
Adding a new notification channel requires no changes to core service:

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

registry.register(new SMSChannel())
```

### 4. Backward Compatibility
- Module-level `dispatchNotification()` export unchanged
- Existing code continues to work
- Public API preserved
- No breaking changes

## Acceptance Criteria ✓

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

## Files Changed

```
9 files changed, 923 insertions(+), 121 deletions(-)

create mode 100644 packages/api/src/services/channels/ChannelRegistry.ts
create mode 100644 packages/api/src/services/channels/EmailChannel.ts
create mode 100644 packages/api/src/services/channels/InAppChannel.ts
create mode 100644 packages/api/src/services/channels/NotificationChannel.ts
create mode 100644 packages/api/src/services/channels/PushChannel.ts
create mode 100644 packages/api/src/services/channels/index.ts
create mode 100644 packages/api/src/services/NOTIFICATION_ADAPTER_PATTERN.md

modify   packages/api/src/services/notification.service.ts
modify   packages/api/src/services/notification.service.test.ts
```

## Architecture

```
notification.service.ts (core)
    ↓
ChannelRegistry (manages channels)
    ↓
Channel Adapters:
├── InAppChannel    (database)
├── EmailChannel    (mailer)
└── PushChannel     (push service)
```

Each channel:
- Implements NotificationChannel interface
- Is tested independently
- Can be added/removed without service changes
- Has own preference gating logic

## Usage Flow

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

## Testing Strategy

### Unit Tests
- Mock channels using Fake* implementations
- Test preference gating logic per channel
- Test deduplication, error resilience, delivery logs
- Test custom channel registration

### Integration Tests
- E2E tests verify preference changes are respected
- Tests confirm channels are selectively called based on preferences
- Tests verify delivery logs are properly recorded

### Verification
- All existing notification tests pass
- E2E API tests unaffected
- Regression tests unaffected (module export preserved)

## Future Enhancements

1. **SMS Channel** - Add SMS delivery (Twilio/AWS SNS)
2. **Slack Channel** - Integration with workspace notifications
3. **Custom Channel API** - Allow users to register custom channels at runtime
4. **Channel Scheduling** - Respect quiet hours per channel
5. **Retry Policies** - Per-channel retry strategies
6. **Channel Metrics** - Track delivery success rates per channel

## Backward Compatibility

✓ All existing module-level exports preserved  
✓ `dispatchNotification()` function unchanged  
✓ Error handling maintained  
✓ Service class functionality unchanged  
✓ No breaking changes to existing code  

## Related Issues

- Closes #1639
- Reference #1050 (Previous notification system refactor)
- Related to #1640 (Fee calculation domain module)

## Reviewer Checklist

- [ ] NotificationChannel interface is clear
- [ ] Each adapter implements interface correctly
- [ ] ChannelRegistry pattern is appropriate
- [ ] Tests use fake channels effectively
- [ ] Documentation explains extensibility
- [ ] Backward compatibility verified
- [ ] No external dependencies added

## Questions?

See documentation in:
- `packages/api/src/services/NOTIFICATION_ADAPTER_PATTERN.md` - Complete architecture guide
- `packages/api/src/services/channels/NotificationChannel.ts` - Interface with docs
- `packages/api/src/services/notification.service.test.ts` - Test examples
- `packages/api/src/services/channels/*.ts` - Channel implementations

