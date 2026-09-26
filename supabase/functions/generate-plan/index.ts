import { buildBrandContext, CHANNELS, hasChannels } from '../_shared/brand.ts'
import { getUserClient, HttpError, json, readJson, serve, str } from '../_shared/http.ts'
import { chatJson } from '../_shared/openai.ts'
import { addValidItems, MAX_PER_WEEK, MIN_PER_WEEK, type PlanItem, sortPlan, type Week, weeksNeedingPosts } from './plan.ts'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseDate(iso: string): number | null {
  if (!ISO_DATE.test(iso)) return null
  const t = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== iso) return null
  return t
}

const DAY = 86_400_000
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10)

serve(async (req) => {
  const { supabase, user } = await getUserClient(req)
  const body = await readJson(req)

  const { data: profile, error: profileError } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profileError) {
    console.error(profileError)
    throw new HttpError(500, "We couldn't load your brand profile. Please try again.")
  }
  if (!hasChannels(profile)) throw new HttpError(400, 'Please set up your brand profile first.')

  // ---- Validate the brief --------------------------------------------------
  const name = str(body.name)
  const business_brief = str(body.business_brief)
  const target_audience = str(body.target_audience)
  const goal = str(body.goal)
  const start_date = str(body.start_date)
  const duration_weeks = Number(body.duration_weeks)
  const channels = Array.isArray(body.channels) ? [...new Set(body.channels.map(str).filter(Boolean))] : []

  const missing = [
    [name, 'a campaign name'],
    [business_brief, 'what the campaign is about'],
    [target_audience, 'who you want to reach'],
    [goal, 'what you want to achieve'],
    [start_date, 'a start date'],
  ]
    .filter(([v]) => !v)
    .map(([, label]) => label)
  if (missing.length) throw new HttpError(400, `Please add ${missing.join(', ')}.`)
  if (!Number.isInteger(duration_weeks) || duration_weeks < 1 || duration_weeks > 12) {
    throw new HttpError(400, 'Please choose between 1 and 12 weeks.')
  }
  if (business_brief.length > 1000) {
    throw new HttpError(400, 'Please keep "What is this campaign about?" under 1,000 characters.')
  }
  if (name.length > 200 || target_audience.length > 500 || goal.length > 500) {
    throw new HttpError(400, 'Some of your answers are too long. Please shorten them.')
  }
  const startTime = parseDate(start_date)
  if (startTime === null) throw new HttpError(400, 'Please pick a valid start date.')
  if (channels.length === 0) throw new HttpError(400, 'Please pick at least one channel for this campaign.')
  const notInProfile = channels.filter((c) => !profile.channels.includes(c) || !CHANNELS.includes(c as any))
  if (notInProfile.length) {
    throw new HttpError(
      400,
      `${notInProfile.join(', ')} ${notInProfile.length === 1 ? 'is' : 'are'} not in your brand profile. Add ${notInProfile.length === 1 ? 'it' : 'them'} there first.`,
    )
  }

  // ---- Weeks: week 1 starts on start_date, each week covers 7 days ---------
  const weeks = Array.from({ length: duration_weeks }, (_, i) => {
    const from = startTime + i * 7 * DAY
    return { week_number: i + 1, from: toIso(from), to: toIso(from + 6 * DAY) }
  })

  // ---- Ask OpenAI ----------------------------------------------------------
  const system = `You are a friendly marketing planner who helps small business owners with no marketing team.
You write ready-to-post content in the owner's own voice.

${buildBrandContext(profile)}`

  const campaignFacts = `CAMPAIGN
- Name: ${name}
- What it is about: ${business_brief}
- Who we want to reach: ${target_audience}
- What we want to achieve: ${goal}
- Channels to use: ${channels.join(', ')}`

  const rules = `RULES
- Use ONLY these channels: ${channels.join(', ')}. Use the channel names exactly as written.
- Spread the posts across these channels in the way that best reaches the audience described above.
- Each post_date must fall inside its week (from and to dates above, inclusive) and use the format YYYY-MM-DD.
- "content_idea" is a short title for the post (under 12 words).
- "copy" is the finished text the owner can post as-is, written for that channel (for Email: the email body; for In-store: poster wording; for WhatsApp: a short friendly message).

Reply with JSON only, in exactly this shape:
{"items":[{"week_number":1,"post_date":"YYYY-MM-DD","channel":"${channels[0]}","content_idea":"...","copy":"..."}]}`

  const weekList = (list: Week[]) => list.map((w) => `- Week ${w.week_number}: ${w.from} to ${w.to}`).join('\n')

  const ask = (content: string) =>
    chatJson([
      { role: 'system', content: system },
      { role: 'user', content },
    ])

  // First request: the whole plan. Say exactly how many posts are needed, so no week is skipped.
  const first = await ask(`Create a week-by-week marketing plan for this campaign.

${campaignFacts}

WEEKS (${weeks.length} in total)
${weekList(weeks)}

${rules}
- Plan ${MIN_PER_WEEK} to ${MAX_PER_WEEK} posts for EVERY one of the ${weeks.length} weeks above. Do not skip any week.
- The "items" list must contain between ${weeks.length * MIN_PER_WEEK} and ${weeks.length * MAX_PER_WEEK} posts in total.
- Build the story across the weeks: introduce, remind, create urgency, say thank you.`)

  const items: PlanItem[] = []
  addValidItems(first?.items, weeks, channels, items)

  // Top-up: if any week still has too few posts, ask once more for just those weeks.
  const shortWeeks = weeksNeedingPosts(items, weeks)
  if (shortWeeks.length) {
    console.warn(`Plan short for weeks ${shortWeeks.map((w) => w.week_number).join(', ')}; asking for a top-up`)
    const planned = sortPlan(items).map((i) => `- ${i.post_date} ${i.channel}: ${i.content_idea}`).join('\n') || '- (none yet)'
    try {
      const topUp = await ask(`We are building a week-by-week marketing plan. Some weeks still need posts.

${campaignFacts}

ALREADY PLANNED (do not repeat these ideas)
${planned}

WEEKS THAT STILL NEED POSTS
${weekList(shortWeeks)}

${rules}
- Plan ${MIN_PER_WEEK} to ${MAX_PER_WEEK} posts for EACH of the weeks listed above, and only for those weeks.`)
      addValidItems(topUp?.items, weeks, channels, items)
    } catch (err) {
      // Keep what we have; a shorter plan is better than no plan.
      console.error('Top-up request failed', err)
    }
    const stillMissing = weeksNeedingPosts(items, weeks)
    if (stillMissing.length) console.warn(`Still short for weeks ${stillMissing.map((w) => w.week_number).join(', ')}`)
  }

  if (items.length === 0) {
    throw new HttpError(502, "The AI didn't send back a usable plan. Please try again.")
  }

  // ---- Save campaign + items in one transaction ------------------------------
  // brand_snapshot: a copy of the saved profile (read from the database above, never from the request).
  const { id: _profileId, user_id: _userId, ...brand_snapshot } = profile
  const { data: campaignId, error: saveError } = await supabase.rpc('create_campaign_with_items', {
    p_campaign: { name, business_brief, target_audience, goal, duration_weeks, start_date, channels, brand_snapshot },
    p_items: sortPlan(items),
  })
  if (saveError || !campaignId) {
    console.error(saveError)
    throw new HttpError(500, "We couldn't save your plan. Please try again.")
  }

  return json({ campaign_id: campaignId, item_count: items.length })
})
