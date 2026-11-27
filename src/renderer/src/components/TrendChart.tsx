import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ScaleRule } from '@shared/domain/habit'
import type { TrendPoint } from '@shared/domain/stats'
import { formatShortDate } from '../lib/format'

interface TrendChartProps {
  title: string
  points: TrendPoint[]
  rule?: ScaleRule | undefined
  /** Notes per date, shown in the tooltip and table. */
  notes?: ReadonlyMap<string, string>
}

const WIDTH = 640
const HEIGHT = 200
const PAD = { top: 12, right: 16, bottom: 26, left: 28 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom
const LEVELS = [1, 2, 3, 4, 5]

/**
 * Line chart of a 1–5 scale over time. A single series, so no legend: the title names it.
 * Days without a log are gaps in the line. Hover or arrow keys move a crosshair with a tooltip,
 * and the same data is available as a table.
 */
export function TrendChart({ title, points, rule, notes }: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null)

  const x = (i: number) => PAD.left + (points.length <= 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W)
  const y = (level: number) => PAD.top + ((5 - level) / 4) * PLOT_H

  // Split into runs of consecutive logged days, so gaps stay gaps.
  const runs: { i: number; level: number }[][] = []
  let run: { i: number; level: number }[] = []
  points.forEach((point, i) => {
    if (point.level === null) {
      if (run.length) runs.push(run)
      run = []
    } else run.push({ i, level: point.level })
  })
  if (run.length) runs.push(run)

  const logged = points.filter((p) => p.level !== null).length
  const tickEvery = points.length > 45 ? 14 : 7
  const lastIndex = points.length - 1
  // Regular ticks every week (or two), plus the last day. Skip a regular tick that sits too close
  // to the last one, so their labels never overlap.
  const isTick = (i: number) =>
    i === lastIndex || (i % tickEvery === 0 && lastIndex - i >= Math.ceil(tickEvery / 2))

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0) return
    const ratio = (event.clientX - box.left) / box.width
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))))
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const last = points.length - 1
    const current = active ?? last
    const next = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setActive(Math.max(0, Math.min(last, next)))
  }

  const activePoint = active === null ? undefined : points[active]
  const activeNote = activePoint ? notes?.get(activePoint.date) : undefined

  return (
    <figure className="trend">
      <figcaption className="trend-title">
        {title}
        <span className="muted">{` · ${logged} of ${points.length} days logged`}</span>
        {rule && (
          <span className="rule-key">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" x2="18" y1="3" y2="3" />
            </svg>
            {`good if ${rule.op === 'lte' ? '≤' : '≥'} ${rule.value}`}
          </span>
        )}
      </figcaption>

      <div className="trend-plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${title}, ${logged} of ${points.length} days logged`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {LEVELS.map((level) => (
            <g key={level} className="trend-grid">
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(level)} y2={y(level)} />
              <text x={PAD.left - 10} y={y(level)} dy="0.32em" textAnchor="end">
                {level}
              </text>
            </g>
          ))}

          {points.map((point, i) =>
            isTick(i) ? (
              <text
                key={point.date}
                className="trend-axis"
                x={x(i)}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              >
                {formatShortDate(point.date)}
              </text>
            ) : null,
          )}

          {rule && (
            <g className="trend-rule">
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(rule.value)} y2={y(rule.value)} />
            </g>
          )}

          {active !== null && (
            <line
              className="trend-crosshair"
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
            />
          )}

          {runs.map((segment) => (
            <polyline
              key={segment[0]?.i}
              className="trend-line"
              points={segment.map((p) => `${x(p.i)},${y(p.level)}`).join(' ')}
            />
          ))}

          {runs.flat().map((p) => (
            <circle
              key={p.i}
              className={`trend-dot ${p.i === active ? 'active' : ''}`}
              cx={x(p.i)}
              cy={y(p.level)}
              r={p.i === active ? 5 : 4}
              data-testid="trend-dot"
            />
          ))}

          <rect
            className="trend-hit"
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {activePoint && active !== null && (
          <div
            className="trend-tooltip"
            role="status"
            style={{
              left: `${(x(active) / WIDTH) * 100}%`,
              top: `${(y(activePoint.level ?? 3) / HEIGHT) * 100}%`,
            }}
          >
            <strong>{activePoint.level === null ? '—' : `Level ${activePoint.level}`}</strong>
            <span>{formatShortDate(activePoint.date)}</span>
            {activeNote && <span className="muted">{activeNote}</span>}
            {activePoint.level === null && <span className="muted">Not logged</span>}
          </div>
        )}
      </div>

      <details className="trend-table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Level</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {points
              .filter((p) => p.level !== null)
              .map((p) => (
                <tr key={p.date}>
                  <td>{formatShortDate(p.date)}</td>
                  <td>{p.level}</td>
                  <td>{notes?.get(p.date) ?? ''}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
