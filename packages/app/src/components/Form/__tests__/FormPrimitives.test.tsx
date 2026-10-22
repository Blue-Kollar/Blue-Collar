import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Input } from '../Input'
import { Select } from '../Select'
import { Checkbox } from '../Checkbox'
import { RadioGroup } from '../Radio'

describe('Input', () => {
  it('associates the label with the input', () => {
    render(<Input label="Email" type="email" />)

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
  })

  it('shows an error with alert semantics and aria wiring', () => {
    render(<Input label="Email" error="Email is required" hint="We never share it" />)

    const input = screen.getByLabelText('Email')
    const error = screen.getByRole('alert')

    expect(error).toHaveTextContent('Email is required')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', error.id)
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument()
  })

  it('shows a hint when there is no error', () => {
    render(<Input label="Email" hint="We never share it" />)

    const input = screen.getByLabelText('Email')
    const hint = screen.getByText('We never share it')

    expect(input).toHaveAttribute('aria-describedby', hint.id)
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('disables the input while loading', () => {
    render(<Input label="Email" loading />)

    expect(screen.getByLabelText('Email')).toBeDisabled()
  })

  it('forwards the ref and change events', () => {
    const ref = createRef<HTMLInputElement>()
    const onChange = vi.fn()
    render(<Input ref={ref} label="Email" onChange={onChange} />)

    expect(ref.current).toBe(screen.getByLabelText('Email'))
    fireEvent.change(ref.current!, { target: { value: 'a@b.test' } })
    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('Select', () => {
  const options = [
    { label: 'XLM', value: 'XLM' },
    { label: 'USDC', value: 'USDC' },
    { label: 'Disabled', value: 'NONE', disabled: true },
  ]

  it('renders the placeholder and all options', () => {
    render(<Select label="Token" options={options} placeholder="Choose a token" />)

    expect(screen.getByRole('option', { name: 'Choose a token' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'XLM' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'USDC' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Disabled' })).toBeDisabled()
  })

  it('reports the selected value through onChange', () => {
    const onChange = vi.fn()
    render(<Select label="Token" options={options} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Token'), { target: { value: 'USDC' } })

    expect(onChange).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Token')).toHaveValue('USDC')
  })

  it('shows error text and marks the field invalid', () => {
    render(<Select label="Token" options={options} error="Choose a token" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a token')
    expect(screen.getByLabelText('Token')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Checkbox', () => {
  it('toggles when clicked', () => {
    render(<Checkbox label="Accept terms" />)

    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' })
    expect(checkbox).not.toBeChecked()

    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('renders error and hint states', () => {
    const { rerender } = render(<Checkbox label="Accept terms" error="Required" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Required')
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')

    rerender(<Checkbox label="Accept terms" hint="Read the policy" />)
    expect(screen.getByText('Read the policy')).toBeInTheDocument()
  })
})

describe('RadioGroup', () => {
  const options = [
    { label: 'Standard', value: 'standard' },
    { label: 'Express', value: 'express' },
    { label: 'Unavailable', value: 'none', disabled: true },
  ]

  it('renders a labelled group and checks the selected option', () => {
    render(<RadioGroup label="Shipping" name="shipping" options={options} value="standard" />)

    expect(screen.getByRole('group', { name: 'Shipping' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Express' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Unavailable' })).toBeDisabled()
  })

  it('calls onChange with the selected value', () => {
    const onChange = vi.fn()
    render(
      <RadioGroup
        label="Shipping"
        name="shipping"
        options={options}
        value="standard"
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Express' }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('express')
  })

  it('shows an error when invalid', () => {
    render(<RadioGroup label="Shipping" name="shipping" options={options} error="Pick one" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Pick one')
  })
})
