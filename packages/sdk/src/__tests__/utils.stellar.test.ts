import { describe, it, expect } from 'vitest';
import {
  STROOPS_PER_XLM,
  MAX_DECIMAL_PLACES,
  formatWalletAddress,
  formatXLM,
  isValidStellarAddress,
} from '../utils/stellar';

describe('utils/stellar', () => {
  describe('constants', () => {
    it('STROOPS_PER_XLM is 10 million', () => {
      expect(STROOPS_PER_XLM).toBe(10_000_000n);
    });
    it('MAX_DECIMAL_PLACES is 7', () => {
      expect(MAX_DECIMAL_PLACES).toBe(7);
    });
  });

  describe('formatWalletAddress', () => {
    it('returns empty string for empty input', () => {
      expect(formatWalletAddress('')).toBe('');
    });
    it('returns short addresses unchanged', () => {
      expect(formatWalletAddress('GABC')).toBe('GABC');
      expect(formatWalletAddress('GABCDEFG')).toBe('GABCDEFG');
    });
    it('shortens long addresses to GABCD…WXYZ form', () => {
      const addr = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const out = formatWalletAddress(addr);
      expect(out).toHaveLength(9); // 4 + 1 + 4
      expect(out).toBe(`${addr.slice(0, 4)}…${addr.slice(-4)}`);
    });
  });

  describe('formatXLM', () => {
    it('formats 10_000_000 stroops as 1 XLM', () => {
      expect(formatXLM(10_000_000)).toBe('1 XLM');
    });
    it('formats 1_500_000 stroops as 0.15 XLM', () => {
      expect(formatXLM(1_500_000)).toBe('0.15 XLM');
    });
    it('accepts bigint input', () => {
      expect(formatXLM(10_000_000n)).toBe('1 XLM');
    });
    it('handles zero', () => {
      expect(formatXLM(0)).toBe('0 XLM');
    });
  });

  describe('isValidStellarAddress', () => {
    it('rejects empty / non-string', () => {
      expect(isValidStellarAddress('')).toBe(false);
      expect(isValidStellarAddress(null as unknown as string)).toBe(false);
    });
    it('rejects wrong length', () => {
      expect(isValidStellarAddress('GABC')).toBe(false);
    });
    it('rejects wrong prefix', () => {
      const bad = 'X' + 'A'.repeat(55);
      expect(isValidStellarAddress(bad)).toBe(false);
    });
    it('accepts a syntactically valid G… address', () => {
      const addr = 'G' + 'A'.repeat(55);
      expect(isValidStellarAddress(addr)).toBe(true);
    });
    it('accepts a syntactically valid C… contract id', () => {
      const addr = 'C' + 'A'.repeat(55);
      expect(isValidStellarAddress(addr)).toBe(true);
    });
    it('rejects lowercase base32', () => {
      const addr = 'g' + 'a'.repeat(55);
      expect(isValidStellarAddress(addr)).toBe(false);
    });
  });
});
