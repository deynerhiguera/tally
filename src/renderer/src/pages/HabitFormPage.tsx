import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { HabitInput } from '@shared/api/habit-repository'
import { parseHabitInput } from '@shared/api/parse'
import type { IsoDate } from '@shared/domain/date'
import type { Habit, HabitKind, HabitTarget, HabitTargetType, ScaleLevel } from '@shared/domain/habit'
import { useApi } from '../api/useApi'
import { errorMessage } from '../lib/errors'
import { KIND_LABEL, TARGET_TYPE_LABEL } from '../lib/format'
import { today } from '../lib/today'

type ScaleRuleChoice = 'none' | 'lte' | 'gte'

interface FormState {
  name: string
  kind: HabitKind
  targetType: HabitTargetType
  max: string
  min: string
  goal: string
  ruleOp: ScaleRuleChoice
  ruleValue: ScaleLevel
  startDate: string
}

const TARGET_TYPES = Object.keys(TARGET_TYPE_LABEL) as HabitTargetType[]
const LEVELS: ScaleLevel[] = [1, 2, 3, 4, 5]
const KINDS: HabitKind[] = ['BUILD', 'BREAK']
const KIND_HELP: Record<HabitKind, string> = {
  BUILD: 'Something to do',
  BREAK: 'Something to keep inside a limit',
}

function emptyForm(): FormState {
  return {
    name: '',
    kind: 'BUILD',
    targetType: 'DAILY_CHECK',
    max: '1',
    min: '3',
    goal: '05:00',
    ruleOp: 'none',
    ruleValue: 2,
    startDate: today(),
  }
}

function formFromHabit(habit: Habit): FormState {
  const form: FormState = {
    ...emptyForm(),
    name: habit.name,
    kind: habit.kind,
    targetType: habit.target.type,
    startDate: habit.startDate,
  }
  const target = habit.target
  if (target.type === 'DAILY_LIMIT' || target.type === 'WEEKLY_LIMIT') form.max = String(target.max)
  if (target.type === 'WEEKLY_GOAL') form.min = String(target.min)
  if (target.type === 'TARGET_TIME') form.goal = target.goal
  if (target.type === 'DAILY_SCALE' && target.rule) {
    form.ruleOp = target.rule.op
    form.ruleValue = target.rule.value
  }
  return form
}

function targetFromForm(form: FormState): HabitTarget {
  switch (form.targetType) {
    case 'DAILY_CHECK':
      return { type: 'DAILY_CHECK' }
    case 'DAILY_LIMIT':
    case 'WEEKLY_LIMIT':
      return { type: form.targetType, max: form.max === '' ? NaN : Number(form.max) }
    case 'WEEKLY_GOAL':
      return { type: 'WEEKLY_GOAL', min: form.min === '' ? NaN : Number(form.min) }
    case 'TARGET_TIME':
      return { type: 'TARGET_TIME', goal: form.goal as never }
    case 'DAILY_SCALE':
      return form.ruleOp === 'none'
        ? { type: 'DAILY_SCALE' }
        : { type: 'DAILY_SCALE', rule: { op: form.ruleOp, value: form.ruleValue } }
  }
}

/** Create (`/habits/new`) or edit (`/habits/:habitId/edit`) a habit. */
export function HabitFormPage() {
  const { habitId } = useParams()
  const isEdit = habitId !== undefined
  const api = useApi()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState | null>(isEdit ? null : emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    api.habits.list().then(
      (habits) => {
        const habit = habits.find((h) => h.id === habitId)
        if (habit) setForm(formFromHabit(habit))
        else setError('This habit does not exist.')
      },
      (e: unknown) => setError(errorMessage(e)),
    )
  }, [api, habitId, isEdit])

  if (!form) {
    return error ? (
      <p role="alert" className="error">
        {error}
      </p>
    ) : (
      <p className="muted">Loading…</p>
    )
  }

  const update = (change: Partial<FormState>) => setForm({ ...form, ...change })

  function changeTargetType(targetType: HabitTargetType) {
    if (!form) return
    // New habits: limits are usually habits to break, everything else something to build.
    const kind = isEdit ? form.kind : targetType.endsWith('_LIMIT') ? 'BREAK' : 'BUILD'
    update({ targetType, kind })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setError(null)
    let input: HabitInput
    try {
      input = parseHabitInput({
        name: form.name,
        kind: form.kind,
        target: targetFromForm(form),
        startDate: form.startDate as IsoDate,
      })
    } catch (e) {
      setError(errorMessage(e))
      return
    }
    setSaving(true)
    try {
      if (isEdit) await api.habits.update(habitId, input)
      else await api.habits.create(input)
      await navigate('/habits')
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>{isEdit ? 'Edit habit' : 'New habit'}</h1>
      </header>

      <form className="habit-form" onSubmit={(event) => void submit(event)} noValidate>
        <label className="field">
          <span>Name</span>
          <input
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Anki review"
            maxLength={80}
            autoFocus
          />
        </label>

        <div className="field">
          <label className="field">
            <span>Target</span>
            <select
              value={form.targetType}
              onChange={(e) => changeTargetType(e.target.value as HabitTargetType)}
              disabled={isEdit}
              aria-describedby={isEdit ? 'target-locked' : undefined}
            >
              {TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TARGET_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
          {isEdit && (
            <small id="target-locked" className="muted">
              The target type can't change. Archive and create a new habit.
            </small>
          )}
        </div>

        {(form.targetType === 'DAILY_LIMIT' || form.targetType === 'WEEKLY_LIMIT') && (
          <label className="field">
            <span>{form.targetType === 'DAILY_LIMIT' ? 'At most, per day' : 'At most, per week'}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={form.max}
              onChange={(e) => update({ max: e.target.value })}
            />
          </label>
        )}

        {form.targetType === 'WEEKLY_GOAL' && (
          <label className="field">
            <span>At least, per week</span>
            <input
              type="number"
              min={1}
              step={1}
              value={form.min}
              onChange={(e) => update({ min: e.target.value })}
            />
          </label>
        )}

        {form.targetType === 'TARGET_TIME' && (
          <label className="field">
            <span>Goal time (at or before)</span>
            <input type="time" value={form.goal} onChange={(e) => update({ goal: e.target.value })} />
          </label>
        )}

        {form.targetType === 'DAILY_SCALE' && (
          <div className="field-row">
            <label className="field">
              <span>A good day is</span>
              <select
                value={form.ruleOp}
                onChange={(e) => update({ ruleOp: e.target.value as ScaleRuleChoice })}
              >
                <option value="none">Any (track the trend only)</option>
                <option value="lte">At most</option>
                <option value="gte">At least</option>
              </select>
            </label>
            {form.ruleOp !== 'none' && (
              <label className="field">
                <span>Level</span>
                <select
                  value={form.ruleValue}
                  onChange={(e) => update({ ruleValue: Number(e.target.value) as ScaleLevel })}
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <fieldset className="field">
          <legend>Kind</legend>
          <div className="segmented">
            {KINDS.map((kind) => (
              <label key={kind}>
                <input
                  type="radio"
                  name="kind"
                  value={kind}
                  checked={form.kind === kind}
                  onChange={() => update({ kind })}
                />
                {KIND_LABEL[kind]}
              </label>
            ))}
          </div>
          <small className="muted">{KIND_HELP[form.kind]}</small>
        </fieldset>

        <label className="field">
          <span>Start date</span>
          <input type="date" value={form.startDate} onChange={(e) => update({ startDate: e.target.value })} />
        </label>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        <div className="form-actions">
          <Link className="button" to="/habits">
            Cancel
          </Link>
          <button type="submit" className="primary" disabled={saving}>
            {isEdit ? 'Save changes' : 'Create habit'}
          </button>
        </div>
      </form>
    </section>
  )
}
