import { beforeEach,describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }))

import { readFileSync } from 'node:fs'

import { render } from './templateEngine.js'

const mockReadFileSync = vi.mocked(readFileSync)

beforeEach(() => vi.clearAllMocks())

describe('render', () => {
  it('replaces all placeholders with provided vars', () => {
    mockReadFileSync.mockReturnValue('<p>Hi {{name}}, click {{link}}</p>' as any)
    const result = render('test.html', { name: 'Alice', link: 'https://example.com' })
    expect(result).toBe('<p>Hi Alice, click https://example.com</p>')
  })

  it('replaces multiple occurrences of the same placeholder', () => {
    mockReadFileSync.mockReturnValue('<p>{{name}} — {{name}}</p>' as any)
    const result = render('test.html', { name: 'Bob' })
    expect(result).toBe('<p>Bob — Bob</p>')
  })

  it('leaves unmatched placeholders untouched when var is missing', () => {
    mockReadFileSync.mockReturnValue('<p>Hi {{name}}, token={{token}}</p>' as any)
    const result = render('test.html', { name: 'Carol' })
    expect(result).toBe('<p>Hi Carol, token={{token}}</p>')
  })

  it('returns the raw template unchanged when vars is empty', () => {
    const raw = '<p>Hello {{name}}</p>'
    mockReadFileSync.mockReturnValue(raw as any)
    const result = render('test.html', {})
    expect(result).toBe(raw)
  })

  it('passes the correct file path to readFileSync', () => {
    mockReadFileSync.mockReturnValue('' as any)
    render('welcome.html', {})
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining('welcome.html'),
      'utf-8',
    )
  })
})
