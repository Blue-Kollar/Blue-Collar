interface Props {
  className?: string;
  size?: number;
}

export default function LogoIcon({ className, size = 32 }: Props) {
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
