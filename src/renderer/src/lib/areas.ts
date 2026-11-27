import { AREAS, type Area } from '@shared/domain/habit'
import { AREA_LABEL } from './format'

export type WithHeadings<T> = Array<{ heading: string } | { item: T }>

/**
 * Orders items by area (in AREAS order, items without an area last, original order kept
 * inside each area) and puts a heading before each group. When no item has an area, the
 * items come back unchanged and without headings.
 */
export function withAreaHeadings<T>(
  items: readonly T[],
  areaOf: (item: T) => Area | undefined,
): WithHeadings<T> {
  if (!items.some((item) => areaOf(item) !== undefined)) return items.map((item) => ({ item }))
  const groups: [string, T[]][] = [
    ...AREAS.map((area): [string, T[]] => [AREA_LABEL[area], items.filter((item) => areaOf(item) === area)]),
    ['Other', items.filter((item) => areaOf(item) === undefined)],
  ]
  return groups.flatMap(([heading, group]) =>
    group.length === 0 ? [] : [{ heading }, ...group.map((item) => ({ item }))],
  )
}
