/**
 * Unified Icon component.
 *
 * Replaces the previous collection of one-off SVG files
 * (LogoIcon, WalletIcon, WorkerIcon, StarIcon, LocationIcon, PhoneIcon,
 * EmailIcon) with a single component driven by the `name` prop.
 *
 * Usage:
 *   <Icon name="star" size={20} className="text-yellow-400" />
 *   <Icon name="star" filled />          // star with fill
 *   <Icon name="logo" size={32} />       // brand logo
 */

export type IconName =
  | 'logo'
  | 'wallet'
  | 'worker'
  | 'star'
  | 'location'
  | 'phone'
  | 'email';

interface IconProps {
  name: IconName;
  /** Width and height in px. Defaults to 24 (32 for logo). */
  size?: number;
  className?: string;
  /**
   * For the `star` icon only — renders a filled star instead of an outline.
   * Ignored for all other icons.
   */
  filled?: boolean;
}

function LogoSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="BlueCollar logo"
    >
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path
        d="M8 22V10h6a4 4 0 0 1 0 8H8m0 0h7a4 4 0 0 1 0 8H8"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 15a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" fill="currentColor" />
      <path d="M6 3l4-1 4 1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function WorkerSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M15 7h4m-2-2v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function StarSvg({
  size,
  className,
  filled,
}: {
  size: number;
  className?: string;
  filled: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LocationSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.314-2.686-6-6-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function PhoneSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmailSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M2 8l10 6 10-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Unified icon component. Add new icons here rather than creating separate
 * SVG component files.
 */
export default function Icon({ name, size, className, filled = false }: IconProps) {
  const defaultSize = name === 'logo' ? 32 : 24;
  const resolvedSize = size ?? defaultSize;

  switch (name) {
    case 'logo':
      return <LogoSvg size={resolvedSize} className={className} />;
    case 'wallet':
      return <WalletSvg size={resolvedSize} className={className} />;
    case 'worker':
      return <WorkerSvg size={resolvedSize} className={className} />;
    case 'star':
      return <StarSvg size={resolvedSize} className={className} filled={filled} />;
    case 'location':
      return <LocationSvg size={resolvedSize} className={className} />;
    case 'phone':
      return <PhoneSvg size={resolvedSize} className={className} />;
    case 'email':
      return <EmailSvg size={resolvedSize} className={className} />;
    default: {
      // Exhaustiveness check — TypeScript will flag unhandled IconName values
      const _exhaustive: never = name;
      return null;
    }
  }
}
