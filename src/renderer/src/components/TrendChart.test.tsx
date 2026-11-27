import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TrendPoint } from '@shared/domain/stats'
import { TrendChart } from './TrendChart'

const points: TrendPoint[] = [
  { date: '2026-11-01', level: 2 },
  { date: '2026-11-02', level: 3 },
  { date: '2026-11-03', level: null },
  { date: '2026-11-04', level: 4 },
  { date: '2026-11-05', level: 1 },
]

describe('TrendChart', () => {
  it('names the chart and counts logged days', () => {
    render(<TrendChart title="Stress level" points={points} />)
    expect(screen.getByRole('img', { name: 'Stress level, 4 of 5 days logged' })).toBeInTheDocument()
  })

  it('draws a dot per logged day and breaks the line at gaps', () => {
    const { container } = render(<TrendChart title="Stress" points={points} />)
    expect(screen.getAllByTestId('trend-dot')).toHaveLength(4)
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('draws the rule as a reference line', () => {
    render(<TrendChart title="Stress" points={points} rule={{ op: 'lte', value: 2 }} />)
    expect(screen.getByText('good if ≤ 2')).toBeInTheDocument()
  })

  it('moves a tooltip with the arrow keys, including over gaps', async () => {
    const user = userEvent.setup()
    render(<TrendChart title="Stress" points={points} notes={new Map([['2026-11-05', 'Calm']])} />)
    await user.tab()
    await user.keyboard('{End}')
    expect(screen.getByRole('status')).toHaveTextContent('Level 1Nov 5Calm')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('status')).toHaveTextContent('—Nov 3Not logged')
    await user.keyboard('{Home}{ArrowLeft}')
    expect(screen.getByRole('status')).toHaveTextContent('Level 2Nov 1')
  })

  it('hides the tooltip when the pointer leaves', () => {
    const { container } = render(<TrendChart title="Stress" points={points} />)
    const hit = container.querySelector('.trend-hit') as Element
    fireEvent.keyDown(container.querySelector('svg') as Element, { key: 'End' })
    expect(screen.getByRole('status')).toBeInTheDocument()
    fireEvent.pointerLeave(hit)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers the data as a table', () => {
    render(<TrendChart title="Stress" points={points} notes={new Map([['2026-11-05', 'Calm']])} />)
    const rows = screen.getAllByRole('row', { hidden: true })
    expect(rows).toHaveLength(1 + 4)
    expect(rows.at(-1)).toHaveTextContent('Nov 51Calm')
  })
})
