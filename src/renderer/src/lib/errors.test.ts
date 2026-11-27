import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('strips the IPC wrapper', () => {
    const error = new Error(
      "Error invoking remote method 'habits:create': InvalidInputError: name is required.",
    )
    expect(errorMessage(error)).toBe('name is required.')
  })

  it('keeps plain messages and non-errors', () => {
    expect(errorMessage(new Error('Boom'))).toBe('Boom')
    expect(errorMessage('text')).toBe('text')
  })
})
