import { assertEquals } from 'jsr:@std/assert@1'
import { addValidItems, type PlanItem, sortPlan, weeksNeedingPosts } from './plan.ts'

const weeks = [
  { week_number: 1, from: '2026-10-01', to: '2026-10-07' },
  { week_number: 2, from: '2026-10-08', to: '2026-10-14' },
  { week_number: 3, from: '2026-10-15', to: '2026-10-21' },
  { week_number: 4, from: '2026-10-22', to: '2026-10-28' },
]
const channels = ['Instagram', 'Facebook']
const post = (post_date: string, channel = 'Instagram', week_number = 1, content_idea = `Idea ${post_date}`) => ({
  week_number,
  post_date,
  channel,
  content_idea,
  copy: 'Some copy',
})

Deno.test('files a post under the week its date falls in, even if the AI labelled the wrong week', () => {
  const items: PlanItem[] = []
  addValidItems([post('2026-10-16', 'Instagram', 1)], weeks, channels, items)
  assertEquals(items.map((i) => i.week_number), [3])
})

Deno.test('drops posts outside the campaign, bad dates, unknown channels and empty text', () => {
  const items: PlanItem[] = []
  addValidItems(
    [
      post('2026-11-30'),
      post('2026-10-32'),
      post('not-a-date'),
      post('2026-10-02', 'TikTok'),
      { ...post('2026-10-03'), copy: '  ' },
    ],
    weeks,
    channels,
    items,
  )
  assertEquals(items.length, 0)
})

Deno.test('normalises channel names and caps each week at 3 posts', () => {
  const items: PlanItem[] = []
  addValidItems(
    ['01', '02', '03', '04'].map((d) => post(`2026-10-${d}`, 'instagram')),
    weeks,
    channels,
    items,
  )
  assertEquals(items.length, 3)
  assertEquals(items[0].channel, 'Instagram')
})

Deno.test('skips exact repeats from a top-up', () => {
  const items: PlanItem[] = []
  addValidItems([post('2026-10-02')], weeks, channels, items)
  addValidItems([post('2026-10-02')], weeks, channels, items)
  assertEquals(items.length, 1)
})

Deno.test('the bug case: only week 1 planned, then a top-up fills weeks 2 to 4', () => {
  const items: PlanItem[] = []
  addValidItems([post('2026-10-01'), post('2026-10-03'), post('2026-10-05', 'Facebook')], weeks, channels, items)
  assertEquals(weeksNeedingPosts(items, weeks).map((w) => w.week_number), [2, 3, 4])

  addValidItems(
    ['09', '12', '16', '19', '23', '26'].map((d) => post(`2026-10-${d}`, 'Facebook')),
    weeks,
    channels,
    items,
  )
  assertEquals(weeksNeedingPosts(items, weeks), [])
  assertEquals(items.length, 9)
  assertEquals(sortPlan(items).map((i) => i.week_number), [1, 1, 1, 2, 2, 3, 3, 4, 4])
})
