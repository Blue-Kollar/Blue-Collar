import { describe, it, expect, vi } from 'vitest'
import { sendSuccess, sendError } from './response.js'

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('sendSuccess', () => {
  it('sends 200 with data and success status by default', () => {
    const res = mockRes()
    sendSuccess(res, { id: '1' })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      data: { id: '1' },
      status: 'success',
      code: 200,
    })
  })

  it('uses provided statusCode', () => {
    const res = mockRes()
    sendSuccess(res, null, { statusCode: 201 })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 201 }))
  })

  it('includes message when provided', () => {
    const res = mockRes()
    sendSuccess(res, {}, { message: 'Created successfully', statusCode: 201 })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Created successfully', status: 'success' }),
    )
  })

  it('omits message key when not provided', () => {
    const res = mockRes()
    sendSuccess(res, {})
    const body = res.json.mock.calls[0][0]
    expect(body).not.toHaveProperty('message')
  })
})

describe('sendError', () => {
  it('sends error envelope with correct shape', () => {
    const res = mockRes()
    sendError(res, 'Not found', 404)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Not found',
      code: 404,
    })
  })

  it('defaults to 500 when no status code provided', () => {
    const res = mockRes()
    sendError(res, 'Server error')
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 500 }))
  })

  it('does not include data in error response', () => {
    const res = mockRes()
    sendError(res, 'Bad request', 400)
    const body = res.json.mock.calls[0][0]
    expect(body).not.toHaveProperty('data')
  })
})
