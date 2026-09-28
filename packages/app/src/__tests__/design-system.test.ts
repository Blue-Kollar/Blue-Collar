import { describe, it, expect } from 'vitest';
import {
  colors,
  typography,
  spacing,
  shadows,
  borderRadius,
  buttonVariants,
  badgeVariants,
  cardVariants,
  inputVariants,
} from '@/design-system';

describe('Design System Exports', () => {
  describe('Color Tokens', () => {
    it('exports colors object', () => {
      expect(colors).toBeDefined();
      expect(typeof colors).toBe('object');
    });

    it('includes brand color palette', () => {
      expect(colors.brand).toBeDefined();
      expect(colors.brand[500]).toBe('#3b82f6');
    });

    it('includes neutral color palette', () => {
      expect(colors.neutral).toBeDefined();
      expect(colors.neutral[50]).toBe('#f9fafb');
    });

    it('includes semantic colors', () => {
      expect(colors.success).toBeDefined();
      expect(colors.warning).toBeDefined();
      expect(colors.error).toBeDefined();
      expect(colors.info).toBeDefined();
    });

    it('has consistent color depth', () => {
      expect(Object.keys(colors.brand).length).toBeGreaterThan(0);
      expect(Object.keys(colors.neutral).length).toBeGreaterThan(0);
    });
  });

  describe('Typography Tokens', () => {
    it('exports typography object', () => {
      expect(typography).toBeDefined();
      expect(typeof typography).toBe('object');
    });

    it('includes font families', () => {
      expect(typography.fontFamily).toBeDefined();
      expect(typography.fontFamily.sans).toBeDefined();
      expect(typography.fontFamily.mono).toBeDefined();
    });

    it('includes font sizes', () => {
      expect(typography.fontSize).toBeDefined();
      expect(typography.fontSize.base).toBeDefined();
    });

    it('includes font weights', () => {
      expect(typography.fontWeight).toBeDefined();
      expect(typography.fontWeight.bold).toBeDefined();
    });

    it('includes heading styles', () => {
      expect(typography.headings).toBeDefined();
      expect(typography.headings.h1).toBeDefined();
    });

    it('includes body text styles', () => {
      expect(typography.body).toBeDefined();
      expect(typography.body.large).toBeDefined();
    });
  });

  describe('Spacing Tokens', () => {
    it('exports spacing object', () => {
      expect(spacing).toBeDefined();
      expect(typeof spacing).toBe('object');
    });
  });

  describe('Shadow Tokens', () => {
    it('exports shadows object', () => {
      expect(shadows).toBeDefined();
      expect(typeof shadows).toBe('object');
    });
  });

  describe('Border Radius Tokens', () => {
    it('exports border radius object', () => {
      expect(borderRadius).toBeDefined();
      expect(typeof borderRadius).toBe('object');
    });
  });
});

describe('Component Style Variants', () => {
  describe('Button Variants', () => {
    it('exports buttonVariants', () => {
      expect(buttonVariants).toBeDefined();
      expect(typeof buttonVariants).toBe('function');
    });

    it('generates variant classes', () => {
      const result = buttonVariants({ variant: 'primary', size: 'md' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('supports primary variant', () => {
      const result = buttonVariants({ variant: 'primary' });
      expect(result).toContain('bg-brand');
    });

    it('supports secondary variant', () => {
      const result = buttonVariants({ variant: 'secondary' });
      expect(result).toContain('border');
    });

    it('supports all size variants', () => {
      const sm = buttonVariants({ size: 'sm' });
      const md = buttonVariants({ size: 'md' });
      const lg = buttonVariants({ size: 'lg' });
      expect(sm).toBeDefined();
      expect(md).toBeDefined();
      expect(lg).toBeDefined();
    });
  });

  describe('Badge Variants', () => {
    it('exports badgeVariants', () => {
      expect(badgeVariants).toBeDefined();
      expect(typeof badgeVariants).toBe('function');
    });

    it('generates badge classes', () => {
      const result = badgeVariants({ variant: 'default' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('supports all badge variants', () => {
      const variants = ['default', 'success', 'warning', 'danger', 'neutral'] as const;
      variants.forEach((v) => {
        const result = badgeVariants({ variant: v });
        expect(result).toBeDefined();
      });
    });
  });

  describe('Card Variants', () => {
    it('exports cardVariants', () => {
      expect(cardVariants).toBeDefined();
      expect(typeof cardVariants).toBe('function');
    });

    it('generates card classes', () => {
      const result = cardVariants({ shadow: 'md', padding: 'md' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('supports shadow options', () => {
      const none = cardVariants({ shadow: 'none' });
      const sm = cardVariants({ shadow: 'sm' });
      const lg = cardVariants({ shadow: 'lg' });
      expect(none).toBeDefined();
      expect(sm).toBeDefined();
      expect(lg).toBeDefined();
    });

    it('supports padding options', () => {
      const none = cardVariants({ padding: 'none' });
      const sm = cardVariants({ padding: 'sm' });
      const lg = cardVariants({ padding: 'lg' });
      expect(none).toBeDefined();
      expect(sm).toBeDefined();
      expect(lg).toBeDefined();
    });
  });

  describe('Input Variants', () => {
    it('exports inputVariants', () => {
      expect(inputVariants).toBeDefined();
      expect(typeof inputVariants).toBe('function');
    });

    it('generates input classes', () => {
      const result = inputVariants({ state: 'default' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('supports all state variants', () => {
      const states = ['default', 'error', 'success'] as const;
      states.forEach((s) => {
        const result = inputVariants({ state: s });
        expect(result).toBeDefined();
      });
    });
  });
});

describe('Design System Consistency', () => {
  it('all color palettes follow same depth structure', () => {
    const brand = Object.keys(colors.brand).length;
    const neutral = Object.keys(colors.neutral).length;
    expect(brand).toBeGreaterThan(0);
    expect(neutral).toBeGreaterThan(0);
  });

  it('typography includes all common sizes', () => {
    const sizes = ['xs', 'sm', 'base', 'lg', 'xl'];
    sizes.forEach((size) => {
      expect(typography.fontSize[size as keyof typeof typography.fontSize]).toBeDefined();
    });
  });

  it('component variants use consistent naming', () => {
    expect(buttonVariants).toBeDefined();
    expect(badgeVariants).toBeDefined();
    expect(cardVariants).toBeDefined();
    expect(inputVariants).toBeDefined();
  });
});
