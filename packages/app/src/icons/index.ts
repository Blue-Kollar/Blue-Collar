/**
 * Icon barrel.
 *
 * The canonical export is the unified `Icon` component (see Icon.tsx).
 * The named re-exports below are kept for backward compatibility while any
 * remaining usages are migrated to `<Icon name="…" />`.
 *
 * Migration path:
 *   Before: import { StarIcon } from '@/icons'
 *   After:  import Icon from '@/icons/Icon'
 *            <Icon name="star" />
 */

export type { IconName } from './Icon';
export { default } from './Icon';

// ---------------------------------------------------------------------------
// Backward-compatible named wrappers — deprecated, prefer <Icon name="…" />
// ---------------------------------------------------------------------------
import Icon from './Icon';

/** @deprecated Use <Icon name="logo" /> */
export function LogoIcon(props: { className?: string; size?: number }) {
  return Icon({ name: 'logo', ...props });
}

/** @deprecated Use <Icon name="wallet" /> */
export function WalletIcon(props: { className?: string; size?: number }) {
  return Icon({ name: 'wallet', ...props });
}

/** @deprecated Use <Icon name="worker" /> */
export function WorkerIcon(props: { className?: string; size?: number }) {
  return Icon({ name: 'worker', ...props });
}

/** @deprecated Use <Icon name="star" filled={…} /> */
export function StarIcon(props: { className?: string; size?: number; filled?: boolean }) {
  return Icon({ name: 'star', filled: false, ...props });
}

/** @deprecated Use <Icon name="location" /> */
export function LocationIcon(props: { className?: string; size?: number }) {
  return Icon({ name: 'location', ...props });
}

/** @deprecated Use <Icon name="phone" /> */
export function PhoneIcon(props: { className?: string; size?: number }) {
  return Icon({ name: 'phone', ...props });
}

/** @deprecated Use <Icon name="email" /> */
export function EmailIcon(props: { className?: string; size?: number }) {
  return Icon({ name: 'email', ...props });
}
