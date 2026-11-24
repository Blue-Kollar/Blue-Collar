/**
 * Payment + messaging surfaces — accessibility regression tests (#1878).
 *
 * Covers the escrow form, conversation list and message thread that make up
 * the wallet/payment and messages pages. Each surface is checked with the
 * shared axe helper and fails on serious/critical WCAG 2.1 AA violations.
 */
import { screen } from '@testing-library/react';
import { renderWithIntl as render } from '@/__tests__/renderWithIntl';
import { describe, it, expect, vi } from 'vitest';
import { expectNoA11yViolations } from './axe-helper';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatStellarAddress: (address: string) => address,
  truncate: (value: string, max: number) => value.slice(0, max),
  formatRelativeTime: () => '2 hours ago',
  formatDate: () => '1 Jan 2026',
  formatTime: () => '12:00',
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Icon = ({ 'aria-label': label }: { 'aria-label'?: string }) =>
    label ? <span role="img" aria-label={label} /> : <span aria-hidden="true" />;
  const mock: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    mock[key] = typeof actual[key] === 'function' ? Icon : actual[key];
  }
  return mock;
});

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data = [],
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, item: unknown) => React.ReactNode;
  }) => (
    <div>
      {data.map((item, index) => (
        <div key={index}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/MessageInput', () => ({
  default: () => (
    <form aria-label="Send a message">
      <label htmlFor="message-body">Message</label>
      <textarea id="message-body" name="body" />
      <button type="submit">Send</button>
    </form>
  ),
}));

describe('Payment surfaces — axe (WCAG 2.1 AA)', () => {
  it('escrow form has no blocking violations', async () => {
    const { default: EscrowForm } = await import('@/features/payments/components/EscrowForm');
    const { container } = render(
      <main>
        <EscrowForm onSubmit={vi.fn()} />
      </main>,
    );

    expect(screen.getByRole('spinbutton', { name: 'Amount' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create|submit|escrow/i })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe('Messaging surfaces — axe (WCAG 2.1 AA)', () => {
  const conversations = [
    {
      id: 'conv-1',
      participants: [
        { userId: 'me', user: { firstName: 'Me', lastName: 'User', avatar: null } },
        { userId: 'other', user: { firstName: 'Ada', lastName: 'Obi', avatar: null } },
      ],
      messages: [
        { id: 'm1', body: 'Hello there', createdAt: '2026-01-01T10:00:00Z', senderId: 'other' },
      ],
      updatedAt: '2026-01-01T10:00:00Z',
    },
  ];

  it('conversation list has no blocking violations', async () => {
    const { default: ConversationList } = await import('@/components/ConversationList');
    const { container } = render(
      <main>
        <ConversationList
          conversations={conversations as never}
          activeId={null}
          onSelect={vi.fn()}
          loading={false}
          currentUserId="me"
        />
      </main>,
    );

    expect(screen.getByRole('button', { name: /Ada Obi/ })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('message thread has no blocking violations', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread');
    const messages = [
      {
        id: 'm1',
        body: 'Hello there',
        createdAt: '2026-01-01T10:00:00Z',
        senderId: 'other',
        sender: { firstName: 'Ada', lastName: 'Obi' },
      },
    ];
    const { container } = render(
      <main>
        <MessageThread
          messages={messages as never}
          conversationId="conv-1"
          onSend={vi.fn()}
          currentUserId="me"
        />
      </main>,
    );

    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
