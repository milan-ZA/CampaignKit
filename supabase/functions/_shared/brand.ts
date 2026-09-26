export const CHANNELS = [
  'Instagram',
  'Facebook',
  'TikTok',
  'LinkedIn',
  'WhatsApp',
  'Email',
  'Google Business Profile',
  'In-store',
] as const

export const IMAGE_SIZES: Record<string, { size: string; format: string }> = {
  Instagram: { size: '1024x1024', format: 'square image for an Instagram feed post' },
  Facebook: { size: '1536x1024', format: 'wide landscape image for a Facebook post' },
  TikTok: { size: '1024x1536', format: 'tall vertical 9:16-style image for a TikTok video cover' },
  LinkedIn: { size: '1536x1024', format: 'wide landscape image for a LinkedIn post' },
  WhatsApp: { size: '1024x1024', format: 'square image to share in a WhatsApp message' },
  Email: { size: '1536x1024', format: 'wide landscape header image for an email newsletter' },
  'Google Business Profile': { size: '1536x1024', format: 'wide landscape image for a Google Business Profile update' },
  'In-store': { size: '1024x1536', format: 'tall portrait image for a printed in-store poster' },
}

export type BrandProfile = Record<string, any>

/** Profile is "ready" once it exists and has at least one channel. */
export function hasChannels(profile: BrandProfile | null): profile is BrandProfile {
  return !!profile && Array.isArray(profile.channels) && profile.channels.length > 0
}

const filled = (v: unknown) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.join(', ') : '')

/**
 * The "brand context" block included in every OpenAI request.
 * Empty fields are skipped.
 */
export function buildBrandContext(p: BrandProfile): string {
  const section = (title: string, rows: [string, unknown][]) => {
    const lines = rows.map(([label, v]) => [label, filled(v)]).filter(([, v]) => v)
    return lines.length ? `${title}\n${lines.map(([l, v]) => `- ${l}: ${v}`).join('\n')}` : ''
  }

  const personal = section('ABOUT THE OWNER', [
    ['Name', p.owner_name],
    ['Why they started the business', p.owner_story],
    ['What they care about', p.owner_values],
    ['How customers describe them', p.owner_personality],
    ['What they know better than anyone', p.owner_expertise],
  ])
  const business = section('ABOUT THE BUSINESS', [
    ['Business name', p.business_name],
    ['What they sell', p.what_you_sell],
    ['Where they are based', p.location],
    ['Customers', p.customers],
    ['What makes them different', p.what_makes_you_different],
    ['Price level', p.price_level],
    ['Website', p.website],
  ])
  const voice = section('BRAND VOICE', [
    ['Language', p.preferred_language],
    ['Tone', p.tone_words],
    ['Words and phrases they like to use', p.words_to_use],
    ['Words they never use', p.words_to_avoid],
    ['Emojis', p.emoji_use],
    ['Image style', p.visual_style],
    ['Brand colours', p.brand_colours],
  ])

  const rules: string[] = []
  const language = filled(p.preferred_language)
  if (language && language !== 'English') {
    rules.push(
      `Write ALL text for the owner (content ideas, post copy, ad scripts and creative briefs) in ${language}. Keep the JSON keys and the channel names in English.`,
    )
  }
  const tone = filled(p.tone_words)
  if (tone) rules.push(`Write in a tone that is ${tone}.`)
  if (filled(p.words_to_use)) rules.push(`Use these words and phrases where they fit naturally: ${filled(p.words_to_use)}.`)
  if (filled(p.words_to_avoid)) rules.push(`Never use these words or phrases: ${filled(p.words_to_avoid)}.`)
  if (p.emoji_use === 'None') rules.push('Do not use any emojis.')
  if (p.emoji_use === 'A few') rules.push('Use a few emojis (at most 1 to 3 per post).')
  if (p.emoji_use === 'Lots') rules.push('Use plenty of emojis where they feel natural.')
  if (filled(p.example_post)) {
    rules.push(`Match the style, rhythm and length of this example post the owner liked writing:\n"""${filled(p.example_post)}"""`)
  }
  rules.push('Use plain, everyday language. No marketing jargon.')

  return [personal, business, voice, `WRITING RULES\n${rules.map((r) => `- ${r}`).join('\n')}`]
    .filter(Boolean)
    .join('\n\n')
}
