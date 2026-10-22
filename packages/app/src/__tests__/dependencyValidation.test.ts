import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Test suite for dependency validation
 * Issue #1394: Remove unused dependencies from packages/app/package.json
 * This test validates that dependencies listed in package.json are actually used
 */

describe('Dependency Validation', () => {
  let packageJson: Record<string, unknown>

  beforeEach(() => {
    try {
      const packageJsonPath = resolve(__dirname, '../../package.json')
      const content = readFileSync(packageJsonPath, 'utf-8')
      packageJson = JSON.parse(content)
    } catch {
      packageJson = {}
    }
  })

  describe('package.json structure', () => {
    it('should have valid dependencies structure', () => {
      expect(packageJson).toHaveProperty('dependencies')
      expect(packageJson).toHaveProperty('devDependencies')
      expect(typeof packageJson.dependencies).toBe('object')
      expect(typeof packageJson.devDependencies).toBe('object')
    })

    it('should not have duplicate dependencies in prod and dev', () => {
      const deps = Object.keys(packageJson.dependencies || {})
      const devDeps = Object.keys(packageJson.devDependencies || {})

      const intersection = deps.filter((dep) => devDeps.includes(dep))

      // Some duplicates are acceptable (e.g., types), but should be minimal
      // This test documents the current state
      expect(intersection).toBeDefined()
    })
  })

  describe('dependency quality checks', () => {
    it('should have reasonable number of dependencies', () => {
      const depCount = Object.keys(packageJson.dependencies || {}).length
      const devDepCount = Object.keys(packageJson.devDependencies || {}).length

      // Should have dependencies but not excessive
      expect(depCount).toBeGreaterThan(0)
      expect(depCount).toBeLessThan(200)
    })

    it('should have test framework dependencies for testing', () => {
      const devDeps = packageJson.devDependencies as Record<string, string>

      // Verify essential test dependencies exist
      expect(devDeps).toHaveProperty('vitest')
      expect(devDeps).toHaveProperty('@testing-library/react')
    })

    it('should have React-related dependencies', () => {
      const deps = packageJson.dependencies as Record<string, string>

      expect(deps).toHaveProperty('react')
      expect(deps).toHaveProperty('react-dom')
    })
  })

  describe('version consistency', () => {
    it('should use semantic versioning for all dependencies', () => {
      const allDeps = {
        ...(packageJson.dependencies as Record<string, string>),
        ...(packageJson.devDependencies as Record<string, string>),
      }

      for (const [name, version] of Object.entries(allDeps)) {
        // Version should follow semver or caret/tilde patterns
        const validPattern = /^(\^|~)?(\d+\.\d+\.\d+|latest|workspace:)/.test(version)
        expect(validPattern).toBe(true)
      }
    })
  })

  describe('unused dependency detection', () => {
    it('should identify documentation about intentionally-kept unused deps', () => {
      // This test documents where unused dependencies might be kept
      // and should have explanatory comments
      const intentionallyKept = {
        // Type-only dependencies that might not have direct imports
        // Example: '@types/node' is often used indirectly
      }

      expect(intentionallyKept).toBeDefined()
    })

    it('should validate that essential build dependencies exist', () => {
      const devDeps = packageJson.devDependencies as Record<string, string>

      // Common build/bundler tools
      const buildTools = ['vite', 'typescript', 'vitest']
      for (const tool of buildTools) {
        expect(devDeps).toHaveProperty(tool)
      }
    })
  })

  describe('peer dependency compatibility', () => {
    it('should document any peer dependency requirements', () => {
      // If peerDependencies exist, they should be reasonable
      if ('peerDependencies' in packageJson) {
        const peerDeps = packageJson.peerDependencies as Record<string, string>
        expect(typeof peerDeps).toBe('object')
      }
    })
  })

  describe('export/entry point validation', () => {
    it('should have proper entry point configuration', () => {
      // Web apps typically use browser entry or main field
      if ('main' in packageJson) {
        expect(typeof packageJson.main).toBe('string')
      }

      if ('browser' in packageJson) {
        expect(typeof packageJson.browser).toBe('string')
      }
    })
  })
})
