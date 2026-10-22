import { describe, it, expect } from 'vitest';
import {
  truncateStellarAddress,
  formatXlmAmount,
  stellarExplorerTxUrl,
  type StellarNetwork,
} from '@/utils/stellar';

describe('Stellar Utilities', () => {
  describe('truncateStellarAddress', () => {
    it('truncates long stellar addresses with default parameters', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU53D47XNGGQY2H5OKNFREE';
      const result = truncateStellarAddress(address);
      expect(result).toContain('…');
      expect(result.startsWith('GBRPYH')).toBe(true);
      expect(result.endsWith('FREE')).toBe(true);
    });

    it('does not truncate addresses shorter than threshold', () => {
      const address = 'GSHORT';
      const result = truncateStellarAddress(address);
      expect(result).toBe(address);
      expect(result).not.toContain('…');
    });

    it('handles empty string input', () => {
      expect(truncateStellarAddress('')).toBe('');
    });

    it('accepts custom lead parameter', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU53D47XNGGQY2H5OKNFREE';
      const result = truncateStellarAddress(address, 10);
      expect(result).toMatch(/^G[A-Z]{9}…/);
    });

    it('accepts custom tail parameter', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU53D47XNGGQY2H5OKNFREE';
      const result = truncateStellarAddress(address, 6, 8);
      expect(result.endsWith('NFREE')).toBe(false);
    });

    it('preserves readability for wallet verification', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU53D47XNGGQY2H5OKNFREE';
      const result = truncateStellarAddress(address);
      expect(result.length).toBeLessThan(address.length);
      expect(result.split('…').length).toBe(2);
    });
  });

  describe('formatXlmAmount', () => {
    it('formats valid amount strings with default fraction digits', () => {
      expect(formatXlmAmount('12.5000000')).toBe('12.50');
    });

    it('formats zero amount', () => {
      expect(formatXlmAmount('0.0000000')).toBe('0.00');
    });

    it('accepts custom fractionDigits parameter', () => {
      expect(formatXlmAmount('12.5000000', 4)).toBe('12.5000');
      expect(formatXlmAmount('99.9999999', 3)).toBe('100.000');
    });

    it('returns original string for non-numeric input', () => {
      const invalid = 'not-a-number';
      expect(formatXlmAmount(invalid)).toBe(invalid);
    });

    it('handles NaN gracefully', () => {
      expect(formatXlmAmount('NaN')).toBe('NaN');
    });

    it('handles large amounts without scientific notation', () => {
      expect(formatXlmAmount('1000000.5000000')).toBe('1000000.50');
    });

    it('handles very small amounts', () => {
      expect(formatXlmAmount('0.0000001')).toBe('0.00');
    });
  });

  describe('stellarExplorerTxUrl', () => {
    it('builds testnet URL by default', () => {
      const url = stellarExplorerTxUrl('abc123');
      expect(url).toBe('https://stellar.expert/explorer/testnet/tx/abc123');
    });

    it('builds public network URL when specified', () => {
      const url = stellarExplorerTxUrl('abc123', 'public');
      expect(url).toBe('https://stellar.expert/explorer/public/tx/abc123');
    });

    it('constructs URLs with different transaction hashes', () => {
      const hash1 = 'tx1234567890abcdef';
      const hash2 = 'tx0987654321fedcba';
      expect(stellarExplorerTxUrl(hash1, 'testnet')).toContain(hash1);
      expect(stellarExplorerTxUrl(hash2, 'public')).toContain(hash2);
    });

    it('uses correct stellar.expert domain', () => {
      const url = stellarExplorerTxUrl('tx123');
      expect(url).toContain('stellar.expert');
    });

    it('maintains HTTPS protocol', () => {
      const url = stellarExplorerTxUrl('tx123');
      expect(url.startsWith('https://')).toBe(true);
    });
  });

  describe('StellarNetwork type', () => {
    it('accepts testnet network type', () => {
      const network: StellarNetwork = 'testnet';
      expect(network).toBe('testnet');
    });

    it('accepts public network type', () => {
      const network: StellarNetwork = 'public';
      expect(network).toBe('public');
    });
  });
});
