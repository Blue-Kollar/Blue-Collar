interface Props {
  className?: string;
  size?: number;
}

export default function WalletIcon({ className, size = 24 }: Props) {
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
