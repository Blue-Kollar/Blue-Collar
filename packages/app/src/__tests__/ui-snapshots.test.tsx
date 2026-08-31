/**
 * Snapshot regression tests for critical, high-reuse shared UI components.
 *
 * Per packages/app/SNAPSHOT_REVIEW_GUIDELINES.md, snapshots are only used here
 * for stable design-system primitives whose DOM is intentionally frozen
 * (Button, Badge, Card, IconButton, StarRating, CategoryBadge, Dialog/Modal,
 * Input). Stateful feature components continue to rely on behavioural
 * assertions elsewhere.
 *
 * Lucide icons and the `cn` class helper are mocked so the emitted markup is
 * deterministic (no unstable SVG path ids, no Tailwind-merge reordering).
 *
 * Run:        pnpm --filter @bluecollar/app test
 * Update:      pnpm --filter @bluecollar/app test -- -u
 * (or)         pnpm --filter @bluecollar/app test -- --update-snapshots
 */
import { render, screen } from '@testing-library/react';
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

// Deterministic class concatenation (mirrors tailwind-merge output for our uses).
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Replace every lucide icon with a stable placeholder so SVG internals never
// pollute the snapshot.
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

describe('Button snapshots', () => {
  const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
  const sizes = ['default', 'sm', 'lg', 'icon'] as const;

  it.each(variants)('renders the %s variant', (variant) => {
    const { container } = render(<Button variant={variant}>Action</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it.each(sizes)('renders the %s size', (size) => {
    const { container } = render(<Button size={size}>Action</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a disabled button', () => {
    const { container } = render(<Button disabled>Action</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── Badge ────────────────────────────────────────────────────────────────────

describe('Badge snapshots', () => {
  const variants = ['default', 'secondary', 'destructive', 'outline'] as const;

  it.each(variants)('renders the %s variant', (variant) => {
    const { container } = render(<Badge variant={variant}>New</Badge>);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── Card ──────────────────────────────────────────────────────────────────────

describe('Card snapshots', () => {
  it('renders a composed card with content', () => {
    const { container } = render(
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
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── Input (native ui) ──────────────────────────────────────────────────────────

describe('Input (ui) snapshots', () => {
  it('renders a default input', () => {
    const { container } = render(<Input placeholder="Email" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a disabled input', () => {
    const { container } = render(<Input placeholder="Email" disabled />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── IconButton ──────────────────────────────────────────────────────────────────

describe('IconButton snapshots', () => {
  it('renders a default icon button with aria-label', () => {
    const { container } = render(
      <IconButton aria-label="Close menu">
        <span data-testid="icon-x" />
      </IconButton>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a disabled icon button', () => {
    const { container } = render(
      <IconButton aria-label="Close menu" disabled>
        <span data-testid="icon-x" />
      </IconButton>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── StarRating ──────────────────────────────────────────────────────────────────

describe('StarRating snapshots', () => {
  it('renders a 3/5 rating', () => {
    const { container } = render(<StarRating rating={3} max={5} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a full 5/5 rating', () => {
    const { container } = render(<StarRating rating={5} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── CategoryBadge ───────────────────────────────────────────────────────────────

describe('CategoryBadge snapshots', () => {
  it('renders a plumber badge (md, label shown)', () => {
    const { container } = render(<CategoryBadge slug="plumber" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a plumber badge without the label', () => {
    const { container } = render(<CategoryBadge slug="plumber" showLabel={false} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a small electrician badge', () => {
    const { container } = render(<CategoryBadge slug="electrician" size="sm" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── Dialog / Modal ──────────────────────────────────────────────────────────────

describe('Dialog (Modal) snapshots', () => {
  it('renders the closed trigger only', () => {
    const { container } = render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders the open modal content', () => {
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
    // Radix renders modal content in a portal on document.body.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toMatchSnapshot();
  });
});
