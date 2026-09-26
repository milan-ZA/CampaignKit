export const CHANNELS = [
  'Instagram',
  'Facebook',
  'TikTok',
  'LinkedIn',
  'WhatsApp',
  'Email',
  'Google Business Profile',
  'In-store',
]

/**
 * Everything the UI needs to know about each channel.
 * seeFirst: characters people see before "more". limit: hard caption limit.
 * shape: the image shape used for thumbnails, placeholders and previews.
 */
export const CHANNEL_INFO = {
  Instagram: {
    slug: 'instagram',
    hint: 'Photos and short videos on your Instagram feed',
    sizeLabel: 'Square, for the Instagram feed',
    shape: 'square',
    seeFirst: 125,
    limit: 2200,
    wide: false,
  },
  Facebook: {
    slug: 'facebook',
    hint: 'Posts on your Facebook page',
    sizeLabel: 'Wide, for a Facebook post',
    shape: 'wide',
    seeFirst: 480,
    limit: null,
    wide: false,
  },
  TikTok: {
    slug: 'tiktok',
    hint: 'Short, upright videos people scroll through',
    sizeLabel: 'Tall, for TikTok',
    shape: 'tall',
    seeFirst: 150,
    limit: 2200,
    wide: false,
  },
  LinkedIn: {
    slug: 'linkedin',
    hint: 'Posts for professionals and business customers',
    sizeLabel: 'Wide, for a LinkedIn post',
    shape: 'wide',
    seeFirst: 210,
    limit: 3000,
    wide: false,
  },
  WhatsApp: {
    slug: 'whatsapp',
    hint: 'Messages and status updates to your customers',
    sizeLabel: 'Square, for a WhatsApp message',
    shape: 'square',
    seeFirst: null,
    limit: null,
    wide: false,
  },
  Email: {
    slug: 'email',
    hint: 'Newsletters to your customer list',
    sizeLabel: 'Wide, for the top of an email',
    shape: 'wide',
    seeFirst: null,
    limit: null,
    wide: true,
  },
  'Google Business Profile': {
    slug: 'gbp',
    hint: 'Your listing on Google Maps and Search',
    sizeLabel: 'Wide, for your Google Business Profile',
    shape: 'wide',
    seeFirst: 750,
    limit: 1500,
    wide: false,
  },
  'In-store': {
    slug: 'instore',
    hint: 'Posters, flyers and signs in your shop',
    sizeLabel: 'Tall, for a printed poster',
    shape: 'tall',
    seeFirst: null,
    limit: null,
    wide: true,
  },
}

export const channelInfo = (channel) =>
  CHANNEL_INFO[channel] ?? {
    slug: 'other',
    hint: '',
    sizeLabel: 'Square',
    shape: 'square',
    seeFirst: null,
    limit: null,
    wide: false,
  }

export const channelColors = (channel) => {
  const slug = channelInfo(channel).slug
  return { background: `var(--ch-${slug}-bg)`, color: `var(--ch-${slug}-fg)` }
}

export const ASPECT_CLASS = { square: 'aspect-square', wide: 'aspect-[3/2]', tall: 'aspect-[2/3]' }

export const TONE_WORDS = ['Friendly', 'Warm', 'Playful', 'Bold', 'Calm', 'Expert', 'Premium', 'Down-to-earth']
export const PRICE_LEVELS = ['Budget', 'Mid-range', 'Premium']
export const EMOJI_OPTIONS = ['None', 'A few', 'Lots']
export const VISUAL_STYLES = ['Photo', 'Illustration', 'Simple graphic']
// Shown on the Brand guidelines tab in two rows, in this order.
export const LANGUAGE_ROWS = [
  ['English', 'French', 'Spanish', 'Portuguese'],
  ['Afrikaans', 'isiZulu', 'isiXhosa'],
]
export const LANGUAGES = LANGUAGE_ROWS.flat()
