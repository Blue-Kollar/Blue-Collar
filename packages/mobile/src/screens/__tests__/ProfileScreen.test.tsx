/**
 * ProfileScreen unit tests (#1040)
 *
 * Covers:
 * - Renders user's details (email, role, name)
 * - Avatar initials
 * - Edit mode toggling
 * - Validation: first name required
 * - Successful save
 * - Save API error
 * - Cancel discards changes
 * - Logout button calls logout
 */
import React from 'react'
import { Alert } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../../lib/api', () => ({
  userApi: {
    updateProfile: jest.fn(),
  },
}))

const { useAuth } = require('../../../context/AuthContext')
const { userApi } = require('../../../lib/api')

// ── Helpers ────────────────────────────────────────────────────────────────────
const defaultUser = {
  id: 'u1',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  role: 'user',
}

const mockLogout = jest.fn()

let ProfileScreen: React.ComponentType

beforeAll(() => {
  ProfileScreen = require('../ProfileScreen').default
})

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    ;(useAuth as jest.Mock).mockReturnValue({ user: defaultUser, logout: mockLogout })
  })

  // ── Display ───────────────────────────────────────────────────────────────
  it('renders the screen root testID', () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('profile-screen')).toBeTruthy()
  })

  it("displays the user's email", () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('email-value').props.children).toBe('jane@example.com')
  })

  it("displays the user's role", () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('role-value').props.children).toBe('user')
  })

  it("displays the full name in view mode", () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('name-value').props.children).toContain('Jane')
    expect(getByTestId('name-value').props.children).toContain('Doe')
  })

  it('renders avatar placeholder with initials', () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('avatar-placeholder')).toBeTruthy()
  })

  it('shows em-dash fallbacks when user is null', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ user: null, logout: mockLogout })
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('email-value').props.children).toBe('—')
  })

  // ── Edit mode ─────────────────────────────────────────────────────────────
  it('switches to edit mode when Edit Profile is pressed', () => {
    const { getByTestId } = render(<ProfileScreen />)
    fireEvent.press(getByTestId('edit-button'))
    expect(getByTestId('first-name-input')).toBeTruthy()
    expect(getByTestId('last-name-input')).toBeTruthy()
  })

  it('cancel reverts changes and exits edit mode', () => {
    const { getByTestId, queryByTestId } = render(<ProfileScreen />)
    fireEvent.press(getByTestId('edit-button'))
    fireEvent.changeText(getByTestId('first-name-input'), 'Changed')
    fireEvent.press(getByTestId('cancel-button'))
    expect(queryByTestId('first-name-input')).toBeNull()
    // Name should revert
    expect(getByTestId('name-value').props.children).toContain('Jane')
  })

  // ── Validation ────────────────────────────────────────────────────────────
  it('shows a validation error when first name is cleared and save is pressed', async () => {
    const { getByTestId } = render(<ProfileScreen />)
    fireEvent.press(getByTestId('edit-button'))
    fireEvent.changeText(getByTestId('first-name-input'), '')

    await act(async () => {
      fireEvent.press(getByTestId('save-button'))
    })

    expect(getByTestId('save-error')).toBeTruthy()
    expect(userApi.updateProfile).not.toHaveBeenCalled()
  })

  // ── Successful save ───────────────────────────────────────────────────────
  it('calls userApi.updateProfile with trimmed values on valid submit', async () => {
    userApi.updateProfile.mockResolvedValue({ ok: true, data: {} })
    const { getByTestId, queryByTestId } = render(<ProfileScreen />)
    fireEvent.press(getByTestId('edit-button'))
    fireEvent.changeText(getByTestId('first-name-input'), '  Jane  ')

    await act(async () => {
      fireEvent.press(getByTestId('save-button'))
    })

    expect(userApi.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Jane' })
    )
    // Edit mode exits on success
    await waitFor(() => expect(queryByTestId('first-name-input')).toBeNull())
  })

  // ── API error ─────────────────────────────────────────────────────────────
  it('shows an error message when save returns a non-OK response', async () => {
    userApi.updateProfile.mockResolvedValue({ ok: false, error: 'Server error' })
    const { getByTestId } = render(<ProfileScreen />)
    fireEvent.press(getByTestId('edit-button'))

    await act(async () => {
      fireEvent.press(getByTestId('save-button'))
    })

    expect(getByTestId('save-error').props.children).toBe('Server error')
  })

  it('shows a generic error when updateProfile throws', async () => {
    userApi.updateProfile.mockRejectedValue(new Error('Network down'))
    const { getByTestId } = render(<ProfileScreen />)
    fireEvent.press(getByTestId('edit-button'))

    await act(async () => {
      fireEvent.press(getByTestId('save-button'))
    })

    expect(getByTestId('save-error')).toBeTruthy()
  })

  // ── Logout ────────────────────────────────────────────────────────────────
  it('renders the logout button', () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('logout-button')).toBeTruthy()
  })

  it('shows a confirmation Alert when logout is pressed', () => {
    const { getByTestId } = render(<ProfileScreen />)
    fireEvent.press(getByTestId('logout-button'))
    expect(Alert.alert).toHaveBeenCalledWith(
      'Logout',
      expect.any(String),
      expect.any(Array)
    )
  })
})
