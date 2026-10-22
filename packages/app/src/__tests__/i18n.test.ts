import { describe, it, expect, beforeAll } from 'vitest';
import type { ResourceLanguage } from 'i18next';

describe('i18n Message Structure', () => {
  let enMessages: Record<string, any>;
  let esMessages: Record<string, any>;
  let frMessages: Record<string, any>;
  let ptMessages: Record<string, any>;

  beforeAll(async () => {
    enMessages = (await import('@/messages/en.json')).default;
    esMessages = (await import('@/messages/es.json')).default;
    frMessages = (await import('@/messages/fr.json')).default;
    ptMessages = (await import('@/messages/pt.json')).default;
  });

  describe('English Messages', () => {
    it('loads en.json successfully', () => {
      expect(enMessages).toBeDefined();
      expect(typeof enMessages).toBe('object');
    });

    it('has common namespace', () => {
      expect(enMessages.common).toBeDefined();
      expect(typeof enMessages.common).toBe('object');
    });

    it('has navigation namespace', () => {
      expect(enMessages.nav).toBeDefined();
      expect(typeof enMessages.nav).toBe('object');
    });

    it('has hero section messages', () => {
      expect(enMessages.hero).toBeDefined();
      expect(enMessages.hero.title).toBeDefined();
      expect(enMessages.hero.subtitle).toBeDefined();
    });

    it('all message values are strings', () => {
      const checkStrings = (obj: Record<string, any>) => {
        Object.values(obj).forEach((value) => {
          if (typeof value === 'object' && value !== null) {
            checkStrings(value);
          } else {
            expect(typeof value).toBe('string');
          }
        });
      };
      checkStrings(enMessages);
    });
  });

  describe('Message Locale Coverage', () => {
    it('all locales are defined', () => {
      expect(enMessages).toBeDefined();
      expect(esMessages).toBeDefined();
      expect(frMessages).toBeDefined();
      expect(ptMessages).toBeDefined();
    });

    it('spanish messages match english structure', () => {
      const enKeys = Object.keys(enMessages);
      const esKeys = Object.keys(esMessages);
      expect(enKeys.sort()).toEqual(esKeys.sort());
    });

    it('french messages match english structure', () => {
      const enKeys = Object.keys(enMessages);
      const frKeys = Object.keys(frMessages);
      expect(enKeys.sort()).toEqual(frKeys.sort());
    });

    it('portuguese messages match english structure', () => {
      const enKeys = Object.keys(enMessages);
      const ptKeys = Object.keys(ptMessages);
      expect(enKeys.sort()).toEqual(ptKeys.sort());
    });
  });

  describe('Namespace Consistency', () => {
    it('common namespace exists in all locales', () => {
      expect(enMessages.common).toBeDefined();
      expect(esMessages.common).toBeDefined();
      expect(frMessages.common).toBeDefined();
      expect(ptMessages.common).toBeDefined();
    });

    it('navigation namespace exists in all locales', () => {
      expect(enMessages.nav).toBeDefined();
      expect(esMessages.nav).toBeDefined();
      expect(frMessages.nav).toBeDefined();
      expect(ptMessages.nav).toBeDefined();
    });

    it('hero namespace exists in all locales', () => {
      expect(enMessages.hero).toBeDefined();
      expect(esMessages.hero).toBeDefined();
      expect(frMessages.hero).toBeDefined();
      expect(ptMessages.hero).toBeDefined();
    });

    it('key count is consistent across locales', () => {
      const countKeys = (obj: Record<string, any>): number => {
        let count = 0;
        Object.values(obj).forEach((value) => {
          if (typeof value === 'object' && value !== null) {
            count += countKeys(value);
          } else {
            count++;
          }
        });
        return count;
      };

      const enCount = countKeys(enMessages);
      const esCount = countKeys(esMessages);
      const frCount = countKeys(frMessages);
      const ptCount = countKeys(ptMessages);

      expect(enCount).toBeGreaterThan(0);
      expect(esCount).toBe(enCount);
      expect(frCount).toBe(enCount);
      expect(ptCount).toBe(enCount);
    });
  });

  describe('Message Key Validation', () => {
    it('no empty translation values', () => {
      const checkEmpty = (obj: Record<string, any>, path = ''): string[] => {
        const empties: string[] = [];
        Object.entries(obj).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          if (typeof value === 'object' && value !== null) {
            empties.push(...checkEmpty(value, fullPath));
          } else if (typeof value === 'string' && value.trim() === '') {
            empties.push(fullPath);
          }
        });
        return empties;
      };

      const emptyKeys = checkEmpty(enMessages);
      expect(emptyKeys).toHaveLength(0);
    });

    it('all common keys are present', () => {
      const expectedCommon = [
        'home',
        'about',
        'workers',
        'dashboard',
        'logout',
        'login',
        'register',
        'search',
      ];
      expectedCommon.forEach((key) => {
        expect(enMessages.common[key]).toBeDefined();
      });
    });

    it('no duplicate keys within namespace', () => {
      const getLeafKeys = (obj: Record<string, any>, prefix = ''): string[] => {
        const keys: string[] = [];
        Object.entries(obj).forEach(([key, value]) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object' && value !== null) {
            keys.push(...getLeafKeys(value, fullKey));
          } else {
            keys.push(fullKey);
          }
        });
        return keys;
      };

      const allKeys = getLeafKeys(enMessages);
      const uniqueKeys = new Set(allKeys);
      expect(allKeys.length).toBe(uniqueKeys.size);
    });
  });

  describe('Message Interpolation Support', () => {
    it('supports parameterized messages', () => {
      // nav.changeLanguage includes {language} placeholder
      expect(enMessages.nav.changeLanguage).toContain('{language}');
    });

    it('parameterized messages have consistent format', () => {
      const checkParams = (obj: Record<string, any>): string[] => {
        const messages: string[] = [];
        Object.values(obj).forEach((value) => {
          if (typeof value === 'object' && value !== null) {
            messages.push(...checkParams(value));
          } else if (typeof value === 'string' && value.includes('{')) {
            messages.push(value);
          }
        });
        return messages;
      };

      const paramMessages = checkParams(enMessages);
      paramMessages.forEach((msg) => {
        expect(msg).toMatch(/\{[a-zA-Z_]+\}/);
      });
    });
  });

  describe('Message File Integrity', () => {
    it('message objects are not nested too deeply', () => {
      const maxDepth = (obj: Record<string, any>, depth = 0): number => {
        let max = depth;
        Object.values(obj).forEach((value) => {
          if (typeof value === 'object' && value !== null) {
            max = Math.max(max, maxDepth(value, depth + 1));
          }
        });
        return max;
      };

      const depth = maxDepth(enMessages);
      expect(depth).toBeLessThanOrEqual(3);
    });

    it('namespace size is reasonable', () => {
      const countEntries = (obj: Record<string, any>): number => {
        let count = 0;
        Object.entries(obj).forEach(([, value]) => {
          if (typeof value === 'object' && value !== null) {
            count += countEntries(value);
          } else {
            count++;
          }
        });
        return count;
      };

      const totalKeys = countEntries(enMessages);
      expect(totalKeys).toBeGreaterThan(50);
      expect(totalKeys).toBeLessThan(1000);
    });
  });
});
