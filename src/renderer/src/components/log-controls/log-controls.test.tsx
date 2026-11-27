import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Habit, HabitTarget, LogValue } from '@shared/domain/habit'
import { CheckControl } from './CheckControl'
import { CounterControl } from './CounterControl'
import { ScaleControl } from './ScaleControl'
import { TimeControl } from './TimeControl'

const habit = (target: HabitTarget): Habit => ({
  id: 'h',
  name: 'Habit',
  kind: 'BUILD',
  target,
  startDate: '2026-11-01',
})

function setup(value: LogValue | undefined) {
  return { value, onSet: vi.fn(), onClear: vi.fn() }
}

describe('CheckControl', () => {
  it('marks done, and clears when pressed again', async () => {
    const props = setup(undefined)
    const { rerender } = render(<CheckControl habit={habit({ type: 'DAILY_CHECK' })} {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Habit done' }))
    expect(props.onSet).toHaveBeenCalledWith({ type: 'CHECK', done: true })

    rerender(
      <CheckControl
        habit={habit({ type: 'DAILY_CHECK' })}
        {...props}
        value={{ type: 'CHECK', done: true }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Habit done' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Habit done' }))
    expect(props.onClear).toHaveBeenCalled()
  })
})

describe('CounterControl', () => {
  const limit = habit({ type: 'DAILY_LIMIT', max: 1 })

  it('increments from zero and shows the daily limit', async () => {
    const props = setup(undefined)
    render(<CounterControl habit={limit} {...props} />)
    expect(screen.getByText('of 1 today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease Habit' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Increase Habit' }))
    expect(props.onSet).toHaveBeenCalledWith({ type: 'COUNT', count: 1 })
  })

  it('clears the log when going back to zero', async () => {
    const props = setup({ type: 'COUNT', count: 1 })
    render(<CounterControl habit={limit} {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Habit' }))
    expect(props.onClear).toHaveBeenCalled()
  })

  it('shows the week total for weekly limits', () => {
    render(
      <CounterControl habit={habit({ type: 'WEEKLY_LIMIT', max: 1 })} {...setup(undefined)} weekCount={2} />,
    )
    expect(screen.getByText('2 of 1 this week')).toBeInTheDocument()
  })
})

describe('TimeControl', () => {
  const wake = habit({ type: 'TARGET_TIME', goal: '05:00' })

  it('saves a typed time when leaving the field', async () => {
    const user = userEvent.setup()
    const props = setup(undefined)
    render(<TimeControl habit={wake} {...props} />)
    await user.type(screen.getByLabelText('Habit time'), '04:48')
    await user.tab()
    expect(props.onSet).toHaveBeenCalledWith({ type: 'TIME', time: '04:48' })
  })

  it('shows minutes early or late for a saved time', () => {
    render(<TimeControl habit={wake} {...setup({ type: 'TIME', time: '05:10' })} />)
    expect(screen.getByText('10 min late')).toBeInTheDocument()
  })

  it('logs the current time with Now', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 27, 4, 52))
    const props = setup(undefined)
    render(<TimeControl habit={wake} {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Habit now' }))
    expect(props.onSet).toHaveBeenCalledWith({ type: 'TIME', time: '04:52' })
    vi.useRealTimers()
  })

  it('clears the log when the field is emptied', async () => {
    const user = userEvent.setup()
    const props = setup({ type: 'TIME', time: '05:10' })
    render(<TimeControl habit={wake} {...props} />)
    await user.clear(screen.getByLabelText('Habit time'))
    await user.tab()
    expect(props.onClear).toHaveBeenCalled()
  })
})

describe('ScaleControl', () => {
  const stress = habit({ type: 'DAILY_SCALE' })

  it('picks a level, and clears when the same level is pressed again', async () => {
    const props = setup(undefined)
    const { rerender } = render(<ScaleControl habit={stress} {...props} />)
    expect(screen.getByLabelText('Habit note')).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Habit level 2' }))
    expect(props.onSet).toHaveBeenCalledWith({ type: 'SCALE', level: 2 })

    rerender(<ScaleControl habit={stress} {...props} value={{ type: 'SCALE', level: 2 }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Habit level 2' }))
    expect(props.onClear).toHaveBeenCalled()
  })

  it('saves a note with the current level', async () => {
    const user = userEvent.setup()
    const props = setup({ type: 'SCALE', level: 3 })
    render(<ScaleControl habit={stress} {...props} />)
    await user.type(screen.getByLabelText('Habit note'), 'Busy week')
    await user.tab()
    expect(props.onSet).toHaveBeenCalledWith({ type: 'SCALE', level: 3, note: 'Busy week' })
  })
})
