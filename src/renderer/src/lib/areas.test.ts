import type { Area } from '@shared/domain/habit'
import { withAreaHeadings } from './areas'

interface Item {
  name: string
  area?: Area
}
const areaOf = (item: Item) => item.area

describe('withAreaHeadings', () => {
  it('leaves items untouched when none has an area', () => {
    const items: Item[] = [{ name: 'a' }, { name: 'b' }]
    expect(withAreaHeadings(items, areaOf)).toEqual([{ item: items[0] }, { item: items[1] }])
  })

  it('groups by area in area order, keeps order inside a group, and puts the rest under Other', () => {
    const items: Item[] = [
      { name: 'TV', area: 'LIFE' },
      { name: 'No area' },
      { name: 'Anki', area: 'ENGLISH' },
      { name: 'Ritual', area: 'SPIRIT' },
      { name: 'Speaking', area: 'ENGLISH' },
    ]
    const flat = withAreaHeadings(items, areaOf).map((entry) =>
      'heading' in entry ? `# ${entry.heading}` : entry.item.name,
    )
    expect(flat).toEqual([
      '# English',
      'Anki',
      'Speaking',
      '# Life',
      'TV',
      '# Spirit',
      'Ritual',
      '# Other',
      'No area',
    ])
  })
})
