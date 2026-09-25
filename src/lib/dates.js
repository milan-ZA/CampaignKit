// All campaign dates are plain calendar dates (YYYY-MM-DD). We do the maths in UTC so
// the user's time zone can never shift a post to a different day.

const DAY = 86_400_000

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const toTime = (iso) => Date.parse(`${iso}T00:00:00Z`)
const toIso = (t) => new Date(t).toISOString().slice(0, 10)

export const addDays = (iso, n) => toIso(toTime(iso) + n * DAY)

export function formatDate(iso, opts = { day: 'numeric', month: 'short' }) {
  if (!iso) return ''
  return new Date(toTime(iso)).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })
}

export function formatRange(from, to) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  const withYear = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${formatDate(from, sameYear ? undefined : withYear)} – ${formatDate(to, withYear)}`
}

export function weekRange(startDate, weekNumber) {
  const from = addDays(startDate, (weekNumber - 1) * 7)
  return { from, to: addDays(from, 6) }
}

export function weekForDate(startDate, iso) {
  return Math.floor((toTime(iso) - toTime(startDate)) / DAY / 7) + 1
}

export function formatTimestamp(ts) {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
