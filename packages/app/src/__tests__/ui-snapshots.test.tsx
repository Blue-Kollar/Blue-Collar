/**
 * Behavioural regression tests for critical, high-reuse shared UI components.
 *
 * Per packages/app/SNAPSHOT_REVIEW_GUIDELINES.md, broad DOM snapshots were
 * removed in favour of targeted assertions on roles, labels, text, disabled
 * state and accessible star ratings. CSS classes and wrapper elements are
 * deliberately not pinned — a Tailwind upgrade or icon change must not break
 * these tests when user-facing behaviour is unchanged (#1869).
 *
 * Run: pnpm --filter @bluecollar/app exec vitest run src/__tests__/ui-snapshots.test.tsx
 */
import { screen } from '@testing-library/react';
import { renderWithIntl as render } from '@/__tests__/renderWithIntl';
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IconButton } from '@/components/IconButton';
import StarRating from '@/components/StarRating';
import { CategoryBadge } from '@/components/CategoryBadge';

// `@/lib/utils` re-exports Stellar helpers from the shared SDK. Isolate the
// UI primitives from unrelated SDK imports so these tests stay offline.
vi.mock('@bluecollar/sdk', () => ({
  STROOPS_PER_XLM: 10_000_000,
  MAX_DECIMAL_PLACES: 7,
  formatWalletAddress: (address: string) => address,
  isValidStellarAddress: () => true,
}));

// Replace every lucide icon with a stable placeholder so tests can assert on a
// test id instead of SVG internals.
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x" />,
  Star: (props: { 'aria-hidden'?: string; className?: string }) => (
    <span data-testid="icon-star" className={props.className} aria-hidden={props['aria-hidden']} />
  ),
  Droplets: () => <span data-testid="icon-droplets" />,
  Zap: () => <span data-testid="icon-zap" />,
  Hammer: () => <span data-testid="icon-hammer" />,
  PaintBucket: () => <span data-testid="icon-paintbucket" />,
  Flame: () => <span data-testid="icon-flame" />,
  Building2: () => <span data-testid="icon-building2" />,
  Wind: () => <span data-testid="icon-wind" />,
  Leaf: () => <span data-testid="icon-leaf" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Wrench: () => <span data-testid="icon-wrench" />,
}));

// ── Button ───────────────────────────────────────────────────────────────────

describe('Button', () => {
  const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
  const sizes = ['default', 'sm', 'lg', 'icon'] as const;

  it.each(variants)('renders an enabled %s button with its label', (variant) => {
    render(<Button variant={variant}>Action</Button>);
    expect(screen.getByRole('button', { name: 'Action' })).toBeEnabled();
  });

  it.each(sizes)('renders an enabled %s button with its label', (size) => {
    render(<Button size={size}>Action</Button>);
    expect(screen.getByRole('button', { name: 'Action' })).toBeEnabled();
  });

  it('renders a disabled button that cannot be clicked', () => {
    render(<Button disabled>Action</Button>);
    expect(screen.getByRole('button', { name: 'Action' })).toBeDisabled();
  });
});

// ── Badge ────────────────────────────────────────────────────────────────────

describe('Badge', () => {
  const variants = ['default', 'secondary', 'destructive', 'outline'] as const;

  it.each(variants)('renders the %s badge text', (variant) => {
    render(<Badge variant={variant}>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});

// ── Card ──────────────────────────────────────────────────────────────────────

describe('Card', () => {
  it('renders a composed card with title, content and action', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Job title</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Description text</p>
        </CardContent>
        <CardFooter>
          <Button>Apply</Button>
        </CardFooter>
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Job title' })).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });
});

// ── Input (native ui) ──────────────────────────────────────────────────────────

describe('Input (ui)', () => {
  it('renders an editable input with its placeholder', () => {
    render(<Input placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toBeEnabled();
  });

  it('renders a disabled input with its placeholder', () => {
    render(<Input placeholder="Email" disabled />);
    expect(screen.getByPlaceholderText('Email')).toBeDisabled();
  });
});

// ── IconButton ──────────────────────────────────────────────────────────────────

describe('IconButton', () => {
  it('exposes its aria-label as the accessible name', () => {
    render(
      <IconButton aria-label="Close menu">
        <span data-testid="icon-x" />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Close menu' })).toBeEnabled();
    expect(screen.getByTestId('icon-x')).toBeInTheDocument();
  });

  it('renders a disabled icon button', () => {
    render(
      <IconButton aria-label="Close menu" disabled>
        <span data-testid="icon-x" />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Close menu' })).toBeDisabled();
  });
});

// ── StarRating ──────────────────────────────────────────────────────────────────

describe('StarRating', () => {
  it('announces a 3/5 rating and renders five stars', () => {
    render(<StarRating rating={3} max={5} />);

    expect(screen.getByRole('img', { name: '3 out of 5 stars' })).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-star')).toHaveLength(5);
  });

  it('announces a full 5/5 rating', () => {
    render(<StarRating rating={5} />);

    expect(screen.getByRole('img', { name: '5 out of 5 stars' })).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-star')).toHaveLength(5);
  });
});

// ── CategoryBadge ───────────────────────────────────────────────────────────────

describe('CategoryBadge', () => {
  it('shows the plumber label and icon', () => {
    render(<CategoryBadge slug="plumber" />);

    expect(screen.getByText('Plumber')).toBeInTheDocument();
    expect(screen.getByTestId('icon-droplets')).toBeInTheDocument();
  });

  it('hides the visible label when showLabel is false', () => {
    render(<CategoryBadge slug="plumber" showLabel={false} />);

    expect(screen.queryByText('Plumber')).not.toBeInTheDocument();
    expect(screen.getByText('Plumber category')).toBeInTheDocument();
  });

  it('shows the small electrician badge', () => {
    render(<CategoryBadge slug="electrician" size="sm" />);

    expect(screen.getByText('Electrician')).toBeInTheDocument();
    expect(screen.getByTestId('icon-zap')).toBeInTheDocument();
  });
});

// ── Dialog / Modal ──────────────────────────────────────────────────────────────

describe('Dialog (Modal)', () => {
  it('renders a closed trigger that opens a dialog', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the open modal title, content and close control', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to continue?</p>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirm action' })).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to continue?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
