import { useParams } from 'react-router'

export function HabitDetailPage() {
  const { habitId } = useParams()
  return (
    <section>
      <h1>Habit {habitId}</h1>
      <p className="muted">Streaks, success rate and trend. Coming in #7.</p>
    </section>
  )
}
