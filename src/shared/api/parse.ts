import type { IsoDate } from '../domain/date'
import { parseIsoDate } from '../domain/date'
import {
  validateTarget,
  type HabitKind,
  type HabitLog,
  type HabitTarget,
  type LogValue,
} from '../domain/habit'
import { isTimeOfDay } from '../domain/time'
import type { HabitInput } from './habit-repository'
import type { Preferences } from './tally-api'

/**
 * Runtime parsers for data crossing a trust boundary (IPC, imported files).
 * Each returns a typed value or throws `InvalidInputError` with a readable message.
 */

export class InvalidInputError extends Error {
  override name = 'InvalidInputError'
}

const MAX_NAME_LENGTH = 80
const MAX_NOTE_LENGTH = 500

function fail(message: string): never {
  throw new InvalidInputError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseId(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) fail(`${field} must be a string.`)
  return value
}

export function parseDate(value: unknown, field = 'date'): IsoDate {
  if (typeof value !== 'string') fail(`${field} must be a YYYY-MM-DD string.`)
  try {
    parseIsoDate(value)
  } catch {
    fail(`${field} must be a valid YYYY-MM-DD date.`)
  }
  return value as IsoDate
}

function parseKind(value: unknown): HabitKind {
  if (value !== 'BUILD' && value !== 'BREAK') fail('kind must be BUILD or BREAK.')
  return value
}

function parseTarget(value: unknown): HabitTarget {
  if (!isRecord(value)) fail('target must be an object.')
  let target: HabitTarget
  switch (value['type']) {
    case 'DAILY_CHECK':
      target = { type: 'DAILY_CHECK' }
      break
    case 'DAILY_LIMIT':
    case 'WEEKLY_LIMIT':
      target = { type: value['type'], max: value['max'] as number }
      break
    case 'TARGET_TIME':
      target = { type: 'TARGET_TIME', goal: value['goal'] as never }
      break
    case 'DAILY_SCALE': {
      const rule = value['rule']
      if (rule === undefined || rule === null) {
        target = { type: 'DAILY_SCALE' }
      } else {
        if (!isRecord(rule)) fail('target.rule must be an object.')
        target = { type: 'DAILY_SCALE', rule: { op: rule['op'] as never, value: rule['value'] as never } }
      }
      break
    }
    default:
      fail('target.type is not a known target type.')
  }
  const problems = validateTarget(target)
  if (problems.length > 0) fail(problems.join(' '))
  return target
}

export function parseHabitInput(value: unknown): HabitInput {
  if (!isRecord(value)) fail('Habit must be an object.')
  const name = value['name']
  if (typeof name !== 'string' || name.trim().length === 0) fail('name is required.')
  if (name.trim().length > MAX_NAME_LENGTH) fail(`name must be at most ${MAX_NAME_LENGTH} characters.`)
  return {
    name: name.trim(),
    kind: parseKind(value['kind']),
    target: parseTarget(value['target']),
    startDate: parseDate(value['startDate'], 'startDate'),
  }
}

/** Parses the shape of a log value. Whether it fits the habit's target is checked by the store. */
export function parseLogValue(value: unknown): LogValue {
  if (!isRecord(value)) fail('value must be an object.')
  switch (value['type']) {
    case 'CHECK':
      if (typeof value['done'] !== 'boolean') fail('done must be true or false.')
      return { type: 'CHECK', done: value['done'] }
    case 'COUNT': {
      const count = value['count']
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 999) {
        fail('count must be a whole number from 0 to 999.')
      }
      return { type: 'COUNT', count }
    }
    case 'TIME': {
      const time = value['time']
      if (typeof time !== 'string' || !isTimeOfDay(time)) fail('time must be HH:mm.')
      return { type: 'TIME', time }
    }
    case 'SCALE': {
      const level = value['level']
      if (level !== 1 && level !== 2 && level !== 3 && level !== 4 && level !== 5)
        fail('level must be 1 to 5.')
      const note = value['note']
      if (note === undefined || note === null || note === '') return { type: 'SCALE', level }
      if (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH) {
        fail(`note must be text of at most ${MAX_NOTE_LENGTH} characters.`)
      }
      return { type: 'SCALE', level, note }
    }
    default:
      fail('value.type is not a known log value type.')
  }
}

export function parseHabitLog(value: unknown): HabitLog {
  if (!isRecord(value)) fail('Log must be an object.')
  return {
    habitId: parseId(value['habitId'], 'habitId'),
    date: parseDate(value['date']),
    value: parseLogValue(value['value']),
  }
}

export function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') fail(`${field} must be true or false.`)
  return value
}

/** Parses a partial preferences change: only known keys, each with the right type. */
export function parsePreferencesChange(value: unknown): Partial<Preferences> {
  if (!isRecord(value)) fail('Preferences must be an object.')
  const change: Partial<Preferences> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'showInMenuBar') change.showInMenuBar = parseBoolean(entry, key)
    else fail(`${key} is not a known preference.`)
  }
  return change
}

export function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value)) fail('ids must be a list.')
  const ids = value.map((id) => parseId(id))
  if (new Set(ids).size !== ids.length) fail('ids must not repeat.')
  return ids
}
