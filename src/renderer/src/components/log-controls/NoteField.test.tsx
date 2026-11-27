import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteField } from './NoteField'

describe('NoteField', () => {
  it('is disabled until something is logged', () => {
    render(<NoteField habitName="Gym" value={undefined} onSet={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Add note for Gym' })).toBeDisabled()
  })

  it('adds a note on Enter and keeps the logged value', async () => {
    const onSet = vi.fn()
    render(<NoteField habitName="Gym" value={{ type: 'COUNT', count: 1 }} onSet={onSet} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add note for Gym' }))
    await userEvent.type(screen.getByLabelText('Gym note'), 'Vert Code day 3{Enter}')
    expect(onSet).toHaveBeenCalledWith({ type: 'COUNT', count: 1, note: 'Vert Code day 3' })
  })

  it('edits and clears an existing note when leaving the field', async () => {
    const onSet = vi.fn()
    render(<NoteField habitName="Gym" value={{ type: 'COUNT', count: 1, note: 'Plyo' }} onSet={onSet} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit note for Gym' }))
    const field = screen.getByLabelText('Gym note')
    expect(field).toHaveValue('Plyo')
    await userEvent.clear(field)
    await userEvent.tab()
    expect(onSet).toHaveBeenCalledWith({ type: 'COUNT', count: 1 })
  })

  it('cancels with Escape and saves nothing when unchanged', async () => {
    const onSet = vi.fn()
    render(<NoteField habitName="Gym" value={{ type: 'COUNT', count: 1, note: 'Plyo' }} onSet={onSet} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit note for Gym' }))
    await userEvent.type(screen.getByLabelText('Gym note'), ' extra{Escape}')
    expect(onSet).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Edit note for Gym' }))
    await userEvent.tab()
    expect(onSet).not.toHaveBeenCalled()
  })
})
