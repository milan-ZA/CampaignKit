import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { downloadFile, slugify } from '../../lib/api'
import { ASPECT_CLASS, channelInfo } from '../../lib/channels'
import { formatDate } from '../../lib/dates'
import Icon from '../Icon'
import Modal from '../Modal'
import { ChannelPill, Spinner } from '../ui'

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Avatar({ name, size = 36 }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-pv-avatar font-bold text-pv-on-avatar"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {letter}
    </span>
  )
}

/** Cuts text after `lines` lines. Shows a "more" button that reveals the rest. */
function ClampText({ text, lines, moreLabel, prefix, className = '', moreClassName = 'bg-pv-frame text-pv-muted' }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, lines, expanded])

  const clampStyle = expanded
    ? undefined
    : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }

  return (
    <div className="relative">
      <p ref={ref} className={`whitespace-pre-wrap break-words ${className}`} style={clampStyle}>
        {prefix}
        {text}
      </p>
      {!expanded && overflowing && moreLabel && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`absolute right-0 bottom-0 pl-1.5 font-medium hover:underline ${moreClassName}`}
        >
          {moreLabel}
        </button>
      )}
    </div>
  )
}

function Placeholder({ job, onGenerate, className = '' }) {
  const loading = job?.status === 'loading'
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 bg-img-placeholder p-4 text-center text-pv-muted ${className}`}
    >
      {loading ? (
        <>
          <Spinner size={26} />
          <p className="max-w-56 text-sm font-medium">Creating your images… this takes about a minute.</p>
        </>
      ) : (
        <>
          <Icon name="image" size={30} />
          <p className="text-sm font-semibold">No image yet</p>
          {job?.status === 'error' && <p className="max-w-60 text-xs text-error">{job.error}</p>}
          <button type="button" className="btn-accent min-h-10 px-3 text-[13px]" onClick={onGenerate}>
            {job?.status === 'error' ? 'Try again' : 'Generate 3 images'}
          </button>
        </>
      )}
    </div>
  )
}

/** The post image (or placeholder) with arrows and dots when there is more than one. */
function Media({ images, index, setIndex, shape, aspectClass, className = '', job, onGenerate, dotsTop = false }) {
  const image = images[index]
  const sizing = aspectClass ?? ASPECT_CLASS[shape]
  if (!image) return <Placeholder job={job} onGenerate={onGenerate} className={`${sizing} ${className}`} />

  const count = images.length
  const position = /\babsolute\b/.test(sizing) ? '' : 'relative'
  return (
    <div className={`${position} overflow-hidden bg-img-placeholder ${sizing} ${className}`}>
      <img src={image.url} alt={`Post image ${index + 1} of ${count}`} className="absolute inset-0 size-full object-cover" />
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => setIndex((index - 1 + count) % count)}
            className="absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-pv-scrim text-pv-on-image"
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => setIndex((index + 1) % count)}
            className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-pv-scrim text-pv-on-image"
          >
            <Icon name="chevronRight" size={18} />
          </button>
          <div
            className={`absolute left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-pv-scrim px-2 py-1 ${
              dotsTop ? 'top-3' : 'bottom-3'
            }`}
          >
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`size-2 rounded-full bg-pv-on-image transition-opacity ${i === index ? '' : 'opacity-40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const handleFor = (name) => (name || 'yourbusiness').toLowerCase().replace(/[^a-z0-9]+/g, '')

const CTA_STARTERS = [
  'order', 'book', 'visit', 'come', 'call', 'shop', 'try', 'join', 'grab', 'pop', 'reply', 'message', 'reserve',
  'get', 'sign up', 'pre-order', 'preorder', 'stop by', 'drop by', 'swing by', 'claim', 'discover', 'taste', 'see',
  'find', 'buy', 'pick up', 'treat', 'bring', 'dm', 'click', 'tap', 'save', 'register', 'rsvp', 'enjoy', 'head',
  'walk', 'start', 'learn', 'warm up', 'reserve', 'secure', 'check out', 'meet',
]
const TRAILING_FILLER = new Set(['to', 'the', 'a', 'an', 'at', 'for', 'and', 'our', 'your', 'of', 'in', 'on', 'with', 'by', 'from', 'this', 'us'])

/** A short button label pulled from the copy, e.g. "Order your lunch". Falls back to "Find out more". */
export function ctaFromCopy(copy) {
  const sentences = String(copy ?? '').split(/(?<=[.!?])\s+|\n+/)
  for (const sentence of sentences) {
    const clean = sentence.replace(/[^\p{L}\p{N}\s'’&-]/gu, ' ').replace(/\s+/g, ' ').trim()
    const lower = clean.toLowerCase()
    if (!CTA_STARTERS.some((v) => lower === v || lower.startsWith(`${v} `))) continue
    const words = clean.split(' ').slice(0, 4)
    while (words.length > 1 && TRAILING_FILLER.has(words[words.length - 1].toLowerCase())) words.pop()
    const label = words.join(' ')
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  return 'Find out more'
}

// ---------------------------------------------------------------------------
// One layout per channel. Generic icons only; no platform names, logos or colours.
// ---------------------------------------------------------------------------

function InstagramLayout({ name, copy, media }) {
  return (
    <div className="mx-auto w-full max-w-[375px] overflow-hidden rounded-[28px] border border-pv-divider bg-pv-frame text-pv-text">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar name={name} size={32} />
        <span className="flex-1 truncate text-[13px] font-bold">{name}</span>
        <Icon name="more" size={20} />
      </div>
      {media({ shape: 'square' })}
      <div className="flex items-center gap-4 px-3 pt-3 pb-2">
        <Icon name="heart" size={24} />
        <Icon name="comment" size={24} />
        <Icon name="share" size={22} />
        <Icon name="bookmark" size={22} className="ml-auto" />
      </div>
      <div className="px-3 pb-1 text-[13px] leading-[1.4]">
        <ClampText text={copy} lines={2} moreLabel="… more" prefix={<strong className="mr-1.5">{name}</strong>} />
      </div>
      <p className="px-3 pt-1 pb-4 text-[11px] text-pv-muted uppercase">Just now</p>
    </div>
  )
}

function FacebookLayout({ name, copy, media }) {
  return (
    <div className="mx-auto w-full max-w-[375px] overflow-hidden rounded-xl border border-pv-divider bg-pv-frame text-pv-text">
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <Avatar name={name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="flex items-center gap-1 text-xs text-pv-muted">
            Just now · <Icon name="globe" size={12} />
          </p>
        </div>
        <Icon name="more" size={20} />
      </div>
      <div className="px-3 py-3 text-sm leading-[1.45]">
        <ClampText text={copy} lines={5} moreLabel="… See more" />
      </div>
      {media({ shape: 'wide' })}
      <div className="mx-3 grid grid-cols-3 border-t border-pv-divider py-1 text-[13px] font-semibold text-pv-muted">
        {[
          ['thumb', 'Like'],
          ['comment', 'Comment'],
          ['share', 'Share'],
        ].map(([icon, label]) => (
          <span key={label} className="flex items-center justify-center gap-1.5 py-2">
            <Icon name={icon} size={18} /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function TikTokLayout({ name, copy, media }) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl bg-pv-frame">
      {media({ aspectClass: 'absolute inset-0', dotsTop: true })}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 scrim-bottom" />
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-5 text-pv-on-image">
        <span className="rounded-full border-2 border-pv-on-image">
          <Avatar name={name} size={40} />
        </span>
        <Icon name="heart" size={30} filled />
        <Icon name="comment" size={30} filled />
        <Icon name="share" size={28} />
      </div>
      <div className="absolute bottom-4 left-3 right-16 text-pv-on-image">
        <p className="text-[15px] font-bold">@{handleFor(name)}</p>
        <ClampText text={copy} lines={2} className="mt-1 text-[13px] leading-[1.4]" />
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <Icon name="music" size={14} /> Original sound · {name}
        </p>
      </div>
    </div>
  )
}

function LinkedInLayout({ name, copy, media }) {
  return (
    <div className="mx-auto w-full max-w-[375px] overflow-hidden rounded-xl border border-pv-divider bg-pv-frame text-pv-text">
      <div className="flex items-start gap-2.5 px-3 pt-3">
        <Avatar name={name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="truncate text-xs text-pv-muted">Local business</p>
          <p className="flex items-center gap-1 text-xs text-pv-muted">
            Just now · <Icon name="globe" size={12} />
          </p>
        </div>
        <Icon name="more" size={20} />
      </div>
      <div className="px-3 py-3 text-sm leading-[1.45]">
        <ClampText text={copy} lines={3} moreLabel="…see more" />
      </div>
      {media({ shape: 'wide' })}
      <div className="mx-2 grid grid-cols-4 border-t border-pv-divider py-1 text-xs font-semibold text-pv-muted">
        {[
          ['thumb', 'Like'],
          ['comment', 'Comment'],
          ['repost', 'Repost'],
          ['send', 'Send'],
        ].map(([icon, label]) => (
          <span key={label} className="flex flex-col items-center gap-1 py-2">
            <Icon name={icon} size={18} /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function WhatsAppLayout({ name, copy, media, hasImage }) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="mx-auto flex w-full max-w-[375px] flex-col overflow-hidden rounded-[28px] border border-pv-divider bg-pv-frame text-pv-text">
      <div className="flex items-center gap-2.5 bg-pv-chrome px-3 py-2.5">
        <Icon name="arrowLeft" size={20} />
        <Avatar name={name} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-[11px] text-pv-muted">online</p>
        </div>
        <Icon name="phone" size={18} />
      </div>
      <div className="chat-wallpaper min-h-[420px] px-3 py-4">
        <p className="mx-auto mb-3 w-fit rounded-md bg-chat-bubble px-2 py-0.5 text-[11px] text-pv-muted">Today</p>
        <div className="w-[85%] rounded-lg rounded-tl-none bg-chat-bubble p-1 shadow-card">
          {media({ shape: 'square', className: 'rounded-md' })}
          <p className={`px-1.5 text-sm leading-[1.4] break-words whitespace-pre-wrap ${hasImage ? 'pt-1.5' : 'pt-1'}`}>{copy}</p>
          <p className="flex items-center justify-end gap-1 px-1.5 pb-0.5 text-[11px] text-pv-muted">
            {time}
            <span className="relative inline-flex w-4 text-link" aria-label="Read">
              <Icon name="check" size={14} strokeWidth={2.5} />
              <Icon name="check" size={14} strokeWidth={2.5} className="absolute left-1" />
            </span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-pv-chrome px-3 py-2.5">
        <span className="flex-1 rounded-full bg-pv-frame px-4 py-2 text-sm text-pv-muted">Message</span>
      </div>
    </div>
  )
}

function EmailLayout({ name, copy, idea, media }) {
  const previewText = copy.length > 90 ? `${copy.slice(0, 90).trimEnd()}…` : copy
  return (
    <div className="mx-auto w-full overflow-hidden rounded-xl border border-pv-divider bg-pv-frame text-pv-text">
      <div className="flex items-center gap-1.5 bg-pv-chrome px-4 py-2.5">
        <span className="size-3 rounded-full bg-pv-divider" />
        <span className="size-3 rounded-full bg-pv-divider" />
        <span className="size-3 rounded-full bg-pv-divider" />
      </div>
      <dl className="space-y-1 border-b border-pv-divider px-5 py-4 text-sm">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-pv-muted">From</dt>
          <dd className="flex min-w-0 items-center gap-2 font-semibold">
            <Avatar name={name} size={22} />
            <span className="truncate">{name}</span>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-pv-muted">Subject</dt>
          <dd className="min-w-0 font-bold">{idea}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-pv-muted">Preview</dt>
          <dd className="min-w-0 truncate text-pv-muted">{previewText}</dd>
        </div>
      </dl>
      <div className="p-5">
        {media({ shape: 'wide', className: 'rounded-lg' })}
        <p className="mt-5 text-[15px] leading-[1.6] break-words whitespace-pre-wrap">{copy}</p>
        <div className="mt-6 text-center">
          <span className="inline-block rounded-lg bg-pv-button px-6 py-3 text-sm font-bold text-pv-on-button">
            {ctaFromCopy(copy)}
          </span>
        </div>
        <p className="mt-8 border-t border-pv-divider pt-4 text-center text-xs text-pv-muted">
          You're getting this email because you're a customer of {name}.
        </p>
      </div>
    </div>
  )
}

function GoogleBusinessLayout({ name, copy, media }) {
  return (
    <div className="mx-auto w-full max-w-[375px] overflow-hidden rounded-xl border border-pv-divider bg-pv-frame text-pv-text">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Avatar name={name} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-xs text-pv-muted">Just now</p>
        </div>
        <Icon name="mapPin" size={18} className="text-pv-muted" />
      </div>
      {media({ shape: 'wide' })}
      <div className="px-4 pt-3 text-sm leading-[1.5]">
        <ClampText text={copy} lines={4} moreLabel="… more" />
      </div>
      <div className="px-4 pt-3 pb-4">
        <span className="inline-block rounded-full border border-pv-divider px-4 py-2 text-sm font-semibold text-link">
          Learn more
        </span>
      </div>
    </div>
  )
}

function InStoreLayout({ name, copy, idea, media }) {
  return (
    <div className="rounded-xl bg-poster-wall px-6 py-8 sm:px-12">
      <div className="mx-auto flex aspect-[1/1.414] w-full max-w-[400px] flex-col overflow-hidden bg-poster-paper text-pv-text shadow-pop">
        {media({ aspectClass: 'h-[52%] shrink-0' })}
        <div className="flex min-h-0 flex-1 flex-col px-6 pt-5 pb-4">
          <h3 className="line-clamp-2 text-2xl leading-tight font-extrabold !text-pv-text">{idea}</h3>
          <p className="mt-2 line-clamp-5 text-[13px] leading-[1.45] break-words whitespace-pre-wrap">{copy}</p>
          <p className="mt-auto border-t border-pv-divider pt-2.5 text-center text-xs font-bold tracking-[0.18em] uppercase">
            {name}
          </p>
        </div>
      </div>
    </div>
  )
}

const LAYOUTS = {
  Instagram: InstagramLayout,
  Facebook: FacebookLayout,
  TikTok: TikTokLayout,
  LinkedIn: LinkedInLayout,
  WhatsApp: WhatsAppLayout,
  Email: EmailLayout,
  'Google Business Profile': GoogleBusinessLayout,
  'In-store': InStoreLayout,
}

// ---------------------------------------------------------------------------
// Length check
// ---------------------------------------------------------------------------

function LengthCheck({ channel, copy }) {
  const info = channelInfo(channel)
  const n = copy.length
  const over = info.limit && n > info.limit
  return (
    <p className={`text-sm ${over ? 'font-semibold text-error' : 'text-muted'}`} role={over ? 'alert' : undefined}>
      {n.toLocaleString()} characters.
      {info.seeFirst && !over && <> People see the first {info.seeFirst} before 'more'.</>}
      {over && (
        <>
          {' '}
          Too long for {channel}. Shorten it by {(n - info.limit).toLocaleString()} characters.
        </>
      )}
    </p>
  )
}

// ---------------------------------------------------------------------------
// The modal
// ---------------------------------------------------------------------------

export default function PostPreview({ item, images, businessName, job, onGenerateImages, onClose, besidePanel = false }) {
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [downloadError, setDownloadError] = useState(null)
  const info = channelInfo(item.channel)
  const Layout = LAYOUTS[item.channel] ?? InstagramLayout
  const name = businessName || 'Your business'
  const copy = item.copy ?? ''
  const imageKey = images.map((i) => i.id).join()

  // New set of images (e.g. just generated): go back to the first one.
  useEffect(() => setIndex(0), [imageKey])

  const current = images[Math.min(index, images.length - 1)]

  const media = (opts) => (
    <Media
      images={images}
      index={Math.min(index, Math.max(images.length - 1, 0))}
      setIndex={setIndex}
      job={job}
      onGenerate={onGenerateImages}
      {...opts}
    />
  )

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(copy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const download = async () => {
    setDownloadError(null)
    try {
      await downloadFile(current.url, `${slugify(name)}-${slugify(item.channel)}-${index + 1}.png`)
    } catch {
      setDownloadError("We couldn't download this image. Please try again.")
    }
  }

  return (
    <Modal
      onClose={onClose}
      width={info.wide ? 640 : 420}
      labelledBy="preview-title"
      fullScreenOnMobile
      besidePanel={besidePanel}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <h2 id="preview-title" className="sr-only">
          Post preview
        </h2>
        <ChannelPill channel={item.channel} />
        <span className="text-sm font-medium text-muted">{formatDate(item.post_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <button type="button" className="btn-icon ml-auto -mr-2" aria-label="Close preview" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>

      <div className="flex-1 px-4 pt-3 pb-5">
        <p className="mb-4 text-xs text-muted">A close guide to how your post will look. Real apps may show it slightly differently.</p>

        <Layout
          name={name}
          copy={copy}
          idea={item.content_idea ?? ''}
          media={media}
          hasImage={images.length > 0}
        />

        <div className="mt-4">
          <LengthCheck channel={item.channel} copy={copy} />
        </div>

        {downloadError && <p className="mt-2 text-sm text-error">{downloadError}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={copyCaption}>
            <Icon name={copied ? 'check' : 'copy'} size={18} />
            {copied ? 'Copied' : 'Copy caption'}
          </button>
          {current && (
            <button type="button" className="btn-secondary flex-1" onClick={download}>
              <Icon name="download" size={18} /> Download image
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
