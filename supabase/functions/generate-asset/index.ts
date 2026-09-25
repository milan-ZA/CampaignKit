import { buildBrandContext } from '../_shared/brand.ts'
import { getUserClient, HttpError, json, readJson, serve, str } from '../_shared/http.ts'
import { chatText } from '../_shared/openai.ts'

const TYPES = ['ad_script', 'creative_brief'] as const
type AssetType = (typeof TYPES)[number]

serve(async (req) => {
  const { supabase, user } = await getUserClient(req)
  const body = await readJson(req)

  const itemId = str(body.item_id)
  const type = str(body.type) as AssetType
  if (!itemId) throw new HttpError(400, 'Please choose a post.')
  if (!TYPES.includes(type)) throw new HttpError(400, 'Please choose "ad_script" or "creative_brief".')

  // RLS means this only returns the item if it belongs to the caller.
  const { data: item, error: itemError } = await supabase
    .from('campaign_items')
    .select('*, campaign:campaigns(*)')
    .eq('id', itemId)
    .maybeSingle()
  if (itemError) console.error(itemError)
  if (!item || item.campaign?.user_id !== user.id) throw new HttpError(404, "We couldn't find that post.")

  const { data: profile } = await supabase.from('brand_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (!profile) throw new HttpError(400, 'Please set up your brand profile first.')

  const campaign = item.campaign
  const context = `CAMPAIGN
- Name: ${campaign.name}
- What it is about: ${campaign.business_brief}
- Who we want to reach: ${campaign.target_audience}
- What we want to achieve: ${campaign.goal}

POST
- Channel: ${item.channel}
- Date: ${item.post_date}
- Idea: ${item.content_idea}
- Copy: ${item.copy}`

  const task =
    type === 'ad_script'
      ? `Write a 15 to 30-second script for a video or audio ad based on this post.
Give each line a timing, like "0-5s". Say what we see (or hear) and what is said.
End with a clear, friendly call to action. Keep it simple enough for the owner to film on a phone.
Use plain text only, no markdown symbols like # or *.`
      : `Write a short brief for a designer who will create the visual for this post. Use these headings, each on its own line followed by 1 to 3 short sentences:
Objective:
Key message:
Visuals: (use the brand's image style${profile.visual_style ? ` "${profile.visual_style}"` : ''} and colours${profile.brand_colours ? ` "${profile.brand_colours}"` : ''})
Format: (the right shape and layout for ${item.channel})
Call to action:
Use plain text only, no markdown symbols like # or *.`

  const text = await chatText([
    { role: 'system', content: `You help small business owners with no marketing team.\n\n${buildBrandContext(profile)}` },
    { role: 'user', content: `${context}\n\nTASK\n${task}` },
  ])

  const { error: saveError } = await supabase.from('campaign_items').update({ [type]: text }).eq('id', item.id)
  if (saveError) {
    console.error(saveError)
    throw new HttpError(500, "We couldn't save the result. Please try again.")
  }

  return json({ type, text })
})
