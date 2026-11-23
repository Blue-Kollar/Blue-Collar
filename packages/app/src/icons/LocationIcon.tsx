interface Props {
  className?: string;
  size?: number;
}

export default function LocationIcon({ className, size = 24 }: Props) {
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
