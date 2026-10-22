import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useForm } from '@/hooks/useForm'

describe('useForm', () => {
  it('initialises with the provided values', () => {
    const { result } = renderHook(() =>
      useForm({ email: '', password: '' }, async () => {})
    )
    expect(result.current.values).toEqual({ email: '', password: '' })
    expect(result.current.errors).toEqual({})
    expect(result.current.isSubmitting).toBe(false)
  })

  it('updates a field value via handleChange', async () => {
    const { result } = renderHook(() =>
      useForm({ email: '' }, async () => {})
    )
    await act(async () => {
      result.current.handleChange({
        target: { name: 'email', value: 'test@example.com' },
      } as React.ChangeEvent<HTMLInputElement>)
    })
    expect(result.current.values.email).toBe('test@example.com')
  })

  it('clears field error when value changes', async () => {
    const validate = (v: { email: string }) =>
      v.email ? {} : { email: 'Required' }
    const { result } = renderHook(() =>
      useForm({ email: '' }, async () => {}, validate)
    )
    // Trigger validation errors by submitting
    await act(async () => {
      await result.current.handleSubmit()
    })
    expect(result.current.errors.email).toBe('Required')
    // Typing clears the error
    await act(async () => {
      result.current.handleChange({
        target: { name: 'email', value: 'a@b.com' },
      } as React.ChangeEvent<HTMLInputElement>)
    })
    expect(result.current.errors.email).toBeUndefined()
  })

  it('sets a value programmatically via setValue', async () => {
    const { result } = renderHook(() =>
      useForm({ count: 0 }, async () => {})
    )
    await act(async () => {
      result.current.setValue('count', 42)
    })
    expect(result.current.values.count).toBe(42)
  })

  it('calls onSubmit with the current values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useForm({ name: 'Alice' }, onSubmit)
    )
    await act(async () => {
      await result.current.handleSubmit()
    })
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Alice' })
  })

  it('does not call onSubmit when validation fails', async () => {
    const onSubmit = vi.fn()
    const validate = (v: { name: string }) =>
      v.name ? {} : { name: 'Name is required' }
    const { result } = renderHook(() =>
      useForm({ name: '' }, onSubmit, validate)
    )
    await act(async () => {
      await result.current.handleSubmit()
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(result.current.errors.name).toBe('Name is required')
  })

  it('sets isSubmitting to true during submission and false after', async () => {
    let resolveFn!: () => void
    const onSubmit = vi.fn(
      () => new Promise<void>((resolve) => { resolveFn = resolve })
    )
    const { result } = renderHook(() => useForm({ x: '' }, onSubmit))

    let submitPromise!: Promise<void>
    act(() => {
      submitPromise = result.current.handleSubmit() as unknown as Promise<void>
    })
    expect(result.current.isSubmitting).toBe(true)
    await act(async () => {
      resolveFn()
      await submitPromise
    })
    expect(result.current.isSubmitting).toBe(false)
  })

  it('resets values and errors to initial state', async () => {
    const validate = (v: { name: string }) =>
      v.name ? {} : { name: 'Required' }
    const { result } = renderHook(() =>
      useForm({ name: '' }, async () => {}, validate)
    )
    await act(async () => {
      result.current.handleChange({
        target: { name: 'name', value: 'Bob' },
      } as React.ChangeEvent<HTMLInputElement>)
    })
    await act(async () => {
      result.current.reset()
    })
    expect(result.current.values.name).toBe('')
    expect(result.current.errors).toEqual({})
  })

  it('prevents default form submission event', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useForm({ x: '' }, onSubmit))
    const preventDefault = vi.fn()
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault,
      } as unknown as React.FormEvent)
    })
    expect(preventDefault).toHaveBeenCalled()
  })
})
