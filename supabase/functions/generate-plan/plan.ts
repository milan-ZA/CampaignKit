// Pure helpers for checking and combining the posts the AI sends back. No network or database
// access, so they can be tested with `deno test` (see plan_test.ts).

export type Week = { week_number: number; from: string; to: string }
export type PlanItem = { week_number: number; post_date: string; channel: string; content_idea: string; copy: string }

export const MIN_PER_WEEK = 2
export const MAX_PER_WEEK = 3

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function isIsoDate(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false
  const t = Date.parse(`${iso}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso
}

/**
 * Checks raw AI items and adds the valid ones to `accepted` (which is changed in place).
 * - The week comes from the post date, so a post the AI labelled with the wrong week number is
 *   filed under the right week instead of being dropped. Dates outside the campaign are dropped.
 * - Channel must be one of the campaign's channels (case-insensitive); the saved name is canonical.
 * - At most MAX_PER_WEEK posts per week; exact repeats (same date, channel and idea) are skipped.
 */
export function addValidItems(raw: unknown, weeks: Week[], channels: string[], accepted: PlanItem[]): void {
  const list = Array.isArray(raw) ? raw : []
  const channelByLower = new Map(channels.map((c) => [c.toLowerCase(), c]))
  for (const r of list) {
    const post_date = text(r?.post_date)
    const channel = channelByLower.get(text(r?.channel).toLowerCase())
    const content_idea = text(r?.content_idea).slice(0, 300)
    const copy = text(r?.copy).slice(0, 5000)
    if (!channel || !content_idea || !copy || !isIsoDate(post_date)) continue

    const week = weeks.find((w) => post_date >= w.from && post_date <= w.to)
    if (!week) continue
    if (accepted.filter((i) => i.week_number === week.week_number).length >= MAX_PER_WEEK) continue
    const duplicate = accepted.some(
      (i) => i.post_date === post_date && i.channel === channel && i.content_idea.toLowerCase() === content_idea.toLowerCase(),
    )
    if (duplicate) continue

    accepted.push({ week_number: week.week_number, post_date, channel, content_idea, copy })
  }
}

/** Weeks that still have fewer than MIN_PER_WEEK posts. */
export function weeksNeedingPosts(items: PlanItem[], weeks: Week[]): Week[] {
  return weeks.filter((w) => items.filter((i) => i.week_number === w.week_number).length < MIN_PER_WEEK)
}

/** Plan order: by week, then date. */
export const sortPlan = (items: PlanItem[]) =>
  [...items].sort((a, b) => a.week_number - b.week_number || a.post_date.localeCompare(b.post_date))
