/**
 * Component style guide — cva variant maps for shared UI primitives.
 * Import these in component files to keep variant logic centralised.
 */
import { cva } from 'class-variance-authority';

/** Button variants */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
        secondary: 'border border-brand-600 text-brand-600 hover:bg-brand-50 active:bg-brand-100',
        ghost: 'text-brand-600 hover:bg-brand-50 active:bg-brand-100',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
      },
      size: {
        sm: 'h-8  px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

/** Badge variants */
export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-brand-100 text-brand-700',
        success: 'bg-green-100 text-green-700',
        warning: 'bg-yellow-100 text-yellow-700',
        danger: 'bg-red-100 text-red-700',
        neutral: 'bg-neutral-100 text-neutral-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

/** Card variants */
export const cardVariants = cva('rounded-xl border bg-white', {
  variants: {
    shadow: {
      none: '',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    },
  },
  defaultVariants: { shadow: 'sm', padding: 'md' },
});

/** Input variants */
export const inputVariants = cva(
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      state: {
        default: 'border-gray-300 focus:border-brand-500 focus:ring-brand-500/20',
        error: 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
        success: 'border-green-400 focus:border-green-500 focus:ring-green-500/20',
      },
    },
    defaultVariants: { state: 'default' },
  },
);
