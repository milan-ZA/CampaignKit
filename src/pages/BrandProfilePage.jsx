import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import LogoUpload from '../components/LogoUpload'
import Modal from '../components/Modal'
import {
  ChannelPill,
  ChoiceGroup,
  ErrorState,
  Field,
  formatSavedAt,
  LoadingState,
  SaveStatus,
  Spinner,
  ToneChips,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useBrand } from '../context/BrandContext'
import { useConfirm } from '../context/ConfirmContext'
import { CHANNEL_INFO, CHANNELS, EMOJI_OPTIONS, LANGUAGES, PRICE_LEVELS, TONE_WORDS, VISUAL_STYLES } from '../lib/channels'
import { supabase } from '../lib/supabase'

const TEXT_MAX = 500
const LINE_MAX = 120

const TABS = [
  { key: 'about', label: 'About you' },
  { key: 'business', label: 'Your business' },
  { key: 'voice', label: 'Brand guidelines' },
  { key: 'channels', label: 'Channels' },
]

const ABOUT_FIELDS = [
  { key: 'owner_name', label: 'Your name', example: 'Example: Sipho Dlamini' },
  {
    key: 'owner_story',
    label: 'Why did you start the business?',
    example: 'Example: I fixed bikes for friends at school and wanted my own workshop.',
    multiline: true,
  },
  {
    key: 'owner_values',
    label: 'What do you care about?',
    example: 'Example: Honest prices, doing the job right the first time.',
    multiline: true,
  },
  {
    key: 'owner_personality',
    label: 'How would customers describe you?',
    example: 'Example: Patient, funny, explains things simply.',
    multiline: true,
  },
  {
    key: 'owner_expertise',
    label: 'What do you know better than anyone?',
    example: 'Example: Getting old bikes back on the road.',
    multiline: true,
  },
]

const BUSINESS_FIELDS = [
  { key: 'business_name', label: 'Business name', example: "Example: Sipho's Bike Shop", required: true },
  {
    key: 'what_you_sell',
    label: 'What do you sell?',
    example: 'Example: Bike repairs, second-hand bikes and parts',
    required: true,
    multiline: true,
    rows: 2,
  },
  { key: 'location', label: 'Where are you based?', example: 'Example: Observatory, Cape Town' },
  {
    key: 'customers',
    label: 'Who are your customers?',
    example: 'Example: Students and people who cycle to work',
    multiline: true,
  },
  {
    key: 'what_makes_you_different',
    label: 'What makes you different?',
    example: 'Example: Same-day repairs and a free safety check with every service',
    multiline: true,
  },
]

const VOICE_TEXT_FIELDS = {
  words_to_use: {
    label: 'Words and phrases you like to use',
    example: 'Example: sorted, ride on, local',
    multiline: true,
    rows: 2,
  },
  words_to_avoid: {
    label: 'Words you never want to use',
    example: 'Example: cheap, guaranteed, best in town',
    multiline: true,
    rows: 2,
  },
  example_post: {
    label: 'Paste a post you liked writing',
    example: 'Optional. We copy its style, length and feel.',
    multiline: true,
    rows: 5,
  },
  brand_colours: { label: 'Brand colours', example: 'Example: warm orange and cream' },
}

const DEMO_PROFILE = {
  owner_name: 'Thandi Mokoena',
  owner_story: 'I grew up baking with my gran and wanted a place where neighbours meet over good bread.',
  owner_values: 'Fresh ingredients, local suppliers, no shortcuts.',
  owner_personality: 'Warm, chatty, always remembers your order.',
  owner_expertise: 'Slow-proved sourdough and hearty winter soups.',
  business_name: 'Sunrise Bakery',
  what_you_sell: 'Artisan bread, pastries, soups and coffee',
  location: 'Parkhurst, Johannesburg',
  customers: 'Office workers and young families nearby',
  what_makes_you_different: 'Everything baked on site before 6am',
  price_level: 'Mid-range',
  website: null,
  preferred_language: 'English',
  tone_words: ['Warm', 'Friendly', 'Down-to-earth'],
  words_to_use: 'fresh, from our oven, neighbours',
  words_to_avoid: 'cheap, deal of the century',
  emoji_use: 'A few',
  example_post: null,
  visual_style: 'Photo',
  brand_colours: 'warm orange, cream and dark brown',
  channels: ['Instagram', 'Facebook', 'WhatsApp', 'Google Business Profile'],
}

const FIELD_KEYS = Object.keys(DEMO_PROFILE)

/** Adds https:// when missing. Returns null for an empty value and false when it isn't a web address. */
function normaliseWebsite(v) {
  const t = String(v ?? '').trim()
  if (!t) return null
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || /\s/.test(withScheme)) return false
    return withScheme
  } catch {
    return false
  }
}

const filled = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v != null)

const SECTION_DONE = {
  about: (f) => filled(f.owner_name) && filled(f.owner_story),
  business: (f) => filled(f.business_name) && filled(f.what_you_sell),
  voice: (f) => filled(f.tone_words) && filled(f.emoji_use) && filled(f.visual_style),
  channels: (f) => filled(f.channels),
}

// Text is stored trimmed; empty text becomes null.
const normalise = (v) => (typeof v === 'string' ? v.trim() || null : v)
const same = (a, b) => JSON.stringify(normalise(a) ?? null) === JSON.stringify(normalise(b) ?? null)

function toForm(profile) {
  const form = {}
  for (const key of FIELD_KEYS) {
    const v = profile?.[key]
    form[key] = Array.isArray(DEMO_PROFILE[key]) ? v ?? [] : v ?? ''
  }
  return form
}

export default function BrandProfilePage() {
  const { user } = useAuth()
  const { profile, setProfile, loading, error: loadError, reload } = useBrand()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'about'

  const [form, setForm] = useState(() => toForm(profile))
  const [status, setStatus] = useState(null) // saving | saved | error
  const [touched, setTouched] = useState({})
  const [websiteError, setWebsiteError] = useState(null)
  const saved = useRef(toForm(profile)) // values confirmed saved in the database
  const pending = useRef({}) // values sent but not confirmed yet
  const unsaved = useRef({}) // fields whose last save failed
  const queue = useRef(Promise.resolve(true))
  const hydrated = useRef(!loading)
  const formRef = useRef(form)
  formRef.current = form

  // Fill the form once the saved profile has loaded (on every login, on any device).
  useEffect(() => {
    if (!loading && !hydrated.current) {
      hydrated.current = true
      setForm(toForm(profile))
      saved.current = toForm(profile)
    }
  }, [loading, profile])

  const baseline = (key) => (key in pending.current ? pending.current[key] : saved.current[key])

  /** True when something on screen hasn't been sent to the database, or its save failed. Reads refs so it's always current. */
  const isDirty = () =>
    Object.keys(unsaved.current).length > 0 || FIELD_KEYS.some((k) => !same(formRef.current[k], baseline(k)))

  /** Upserts the given fields (on user_id). Saves run one after another so they land in order. Resolves to true on success. */
  const persist = (patch) => {
    Object.assign(pending.current, patch)
    const run = async () => {
      setStatus('saving')
      const row = { user_id: user.id }
      for (const [k, v] of Object.entries(patch)) row[k] = normalise(v)
      const upsert = () => supabase.from('brand_profiles').upsert(row, { onConflict: 'user_id' }).select().single()
      let { data, error } = await upsert()
      // A network blip (no database error code) gets one quiet retry before we show an error.
      if (error && !error.code) {
        await new Promise((r) => setTimeout(r, 800))
        ;({ data, error } = await upsert())
      }
      for (const k of Object.keys(patch)) {
        if (pending.current[k] === patch[k]) delete pending.current[k]
      }
      if (error) {
        Object.assign(unsaved.current, patch)
        setStatus('error')
        return false
      }
      for (const k of Object.keys(patch)) {
        saved.current[k] = patch[k]
        delete unsaved.current[k]
      }
      setProfile(data)
      setStatus(Object.keys(unsaved.current).length ? 'error' : 'saved')
      return true
    }
    queue.current = queue.current.then(run, run)
    return queue.current
  }

  const saveField = (key, value = formRef.current[key]) => {
    if (same(value, baseline(key)) && !(key in unsaved.current)) return
    persist({ [key]: value })
  }

  /** "Save brand profile": saves all four tabs at once. */
  const saveAll = () => {
    const all = { ...formRef.current }
    const website = normaliseWebsite(all.website)
    if (website === false) {
      // Keep the last saved address rather than failing the whole save.
      setWebsiteError('Please enter a web address, for example sunrisebakery.co.za')
      all.website = saved.current.website
    } else {
      all.website = website ?? ''
    }
    return persist(all)
  }

  // Warn before leaving with unsaved changes: in-app navigation…
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname && isDirty(),
  )
  // …and closing or reloading the tab.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  })

  const [leaveError, setLeaveError] = useState(null)
  const saveAndLeave = async () => {
    setLeaveError(null)
    if (await saveAll()) blocker.proceed?.()
    else setLeaveError("We couldn't save your changes. Try again, or leave without saving.")
  }

  const retry = () => persist({ ...unsaved.current })

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  /** For chips, choices and tiles there is no "leaving the field", so save on change. */
  const setAndSave = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    saveField(key, value)
  }

  const blur = (key) => () => {
    setTouched((t) => ({ ...t, [key]: true }))
    saveField(key)
  }

  const blurWebsite = () => {
    const v = normaliseWebsite(formRef.current.website)
    if (v === false) return setWebsiteError('Please enter a web address, for example sunrisebakery.co.za')
    setWebsiteError(null)
    setForm((f) => ({ ...f, website: v ?? '' }))
    saveField('website', v ?? '')
  }

  const applyDemo = async () => {
    const hasData = !!profile || FIELD_KEYS.some((k) => filled(form[k]))
    if (
      hasData &&
      !(await confirm({
        title: 'Replace your saved brand profile with the demo?',
        message: 'Everything on all four tabs will be replaced with the Sunrise Bakery example.',
        confirmLabel: 'Use demo profile',
      }))
    ) {
      return
    }
    setForm(toForm(DEMO_PROFILE))
    persist({ ...DEMO_PROFILE })
  }

  const doneCount = useMemo(() => TABS.filter((t) => SECTION_DONE[t.key](form)).length, [form])

  if (loading) return <LoadingState message="Loading your brand profile…" />
  if (loadError) {
    return (
      <main className="px-4 py-12">
        <ErrorState message={loadError} onRetry={reload} />
      </main>
    )
  }

  const textField = (def) => (
    <Field
      key={def.key}
      id={def.key}
      label={def.label}
      example={def.example}
      required={def.required}
      multiline={def.multiline}
      rows={def.rows}
      maxLength={def.multiline ? TEXT_MAX : LINE_MAX}
      value={form[def.key]}
      onChange={set(def.key)}
      onBlur={blur(def.key)}
    />
  )

  const dirty = isDirty()

  const requiredError = (key, message) =>
    touched[key] && !filled(form[key]) ? <p className="-mt-3 text-sm font-medium text-error">{message}</p> : null

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Your brand profile</h1>
          <p className="mt-1 text-body">We use this in every plan, post and image we create for you.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={applyDemo}>
          Use demo profile
        </button>
      </div>

      {profile && (
        <section className="card mt-6 p-5" aria-label="Your saved brand profile">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Saved brand profile</p>
              <h2 className="mt-0.5 text-xl">{profile.business_name || 'Business name not added yet'}</h2>
            </div>
            <span className="text-[13px] text-muted">Last saved {formatSavedAt(profile.updated_at)}</span>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Tone</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {profile.tone_words?.length ? <ToneChips words={profile.tone_words} /> : <span className="text-muted">Not picked yet</span>}
              </dd>
            </div>
            <div className="flex gap-6">
              <div>
                <dt className="text-muted">Emojis</dt>
                <dd className="mt-1 font-semibold text-heading">{profile.emoji_use || '–'}</dd>
              </div>
              <div>
                <dt className="text-muted">Image style</dt>
                <dd className="mt-1 font-semibold text-heading">{profile.visual_style || '–'}</dd>
              </div>
              <div>
                <dt className="text-muted">Language</dt>
                <dd className="mt-1 font-semibold text-heading">{profile.preferred_language || 'English'}</dd>
              </div>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Channels</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {profile.channels?.length ? (
                  profile.channels.map((ch) => <ChannelPill key={ch} channel={ch} />)
                ) : (
                  <span className="font-medium text-error">Pick at least one channel</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-week"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={doneCount}
            aria-label="Sections complete"
          >
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(doneCount / 4) * 100}%` }} />
          </div>
          <span className="text-sm font-semibold text-heading">{doneCount} of 4 sections complete</span>
        </div>
        <div className="min-h-6">
          <SaveStatus status={status} onRetry={retry} />
        </div>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border" role="tablist" aria-label="Brand profile sections">
        {TABS.map((t) => {
          const active = t.key === tab
          const done = SECTION_DONE[t.key](form)
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              onClick={() => setParams({ tab: t.key }, { replace: true })}
              className={`-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-[3px] px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                active ? 'border-accent text-heading' : 'border-transparent text-muted hover:text-heading'
              }`}
            >
              {done && <Icon name="check" size={16} className="text-success" title="Complete" />}
              {t.label}
            </button>
          )
        })}
      </div>

      <section
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="card mt-6 space-y-6 p-5 sm:p-7"
      >
        {tab === 'about' && ABOUT_FIELDS.map(textField)}

        {tab === 'business' && (
          <>
            {textField(BUSINESS_FIELDS[0])}
            {requiredError('business_name', 'Please add your business name.')}
            {textField(BUSINESS_FIELDS[1])}
            {requiredError('what_you_sell', 'Please tell us what you sell.')}
            {BUSINESS_FIELDS.slice(2).map(textField)}
            <ChoiceGroup
              label="Price level"
              example="How your prices compare with similar businesses nearby."
              options={PRICE_LEVELS}
              value={form.price_level}
              onChange={setAndSave('price_level')}
            />
            <Field
              id="website"
              label="Your website"
              example="Optional. Example: sunrisebakery.co.za"
              type="url"
              inputMode="url"
              autoComplete="url"
              maxLength={300}
              value={form.website}
              onChange={(v) => {
                setWebsiteError(null)
                set('website')(v)
              }}
              onBlur={blurWebsite}
            />
            {websiteError && <p className="-mt-3 text-sm font-medium text-error">{websiteError}</p>}
            <LogoUpload userId={user.id} path={profile?.logo_path ?? null} onSave={(logo_path) => persist({ logo_path })} />
          </>
        )}

        {tab === 'voice' && (
          <>
            <ChoiceGroup
              label="Language for your content"
              example="We write your plans, posts, ad scripts and creative briefs in this language."
              options={LANGUAGES}
              value={form.preferred_language || 'English'}
              onChange={setAndSave('preferred_language')}
            />
            <ChoiceGroup
              label="Pick up to 3 words that describe how you sound"
              example={`Example: Warm, Friendly, Down-to-earth. ${form.tone_words.length} of 3 picked.`}
              options={TONE_WORDS}
              value={form.tone_words}
              onChange={setAndSave('tone_words')}
              multiple
              max={3}
            />
            {textField({ key: 'words_to_use', ...VOICE_TEXT_FIELDS.words_to_use })}
            {textField({ key: 'words_to_avoid', ...VOICE_TEXT_FIELDS.words_to_avoid })}
            <ChoiceGroup
              label="Emojis"
              example="How many emojis you like in your posts."
              options={EMOJI_OPTIONS}
              value={form.emoji_use}
              onChange={setAndSave('emoji_use')}
            />
            {textField({ key: 'example_post', ...VOICE_TEXT_FIELDS.example_post })}
            <ChoiceGroup
              label="Image style"
              example="The look of the images we create for you."
              options={VISUAL_STYLES}
              value={form.visual_style}
              onChange={setAndSave('visual_style')}
            />
            {textField({ key: 'brand_colours', ...VOICE_TEXT_FIELDS.brand_colours })}
          </>
        )}

        {tab === 'channels' && (
          <fieldset>
            <legend className="label text-base">Where do you market your business?</legend>
            <p className="hint">Pick every place you post or talk to customers. Your plans will only use these.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CHANNELS.map((ch) => {
                const on = form.channels.includes(ch)
                return (
                  <button
                    key={ch}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setAndSave('channels')(on ? form.channels.filter((c) => c !== ch) : [...form.channels, ch])
                    }
                    className={`relative flex min-h-24 flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-colors ${
                      on ? 'border-link bg-link-soft' : 'border-border bg-surface hover:border-input'
                    }`}
                  >
                    <ChannelPill channel={ch} className="text-[13px]" />
                    <span className="pr-8 text-sm text-body">{CHANNEL_INFO[ch].hint}</span>
                    <span
                      className={`absolute right-3 top-3 flex size-6 items-center justify-center rounded-full border-2 ${
                        on ? 'border-link bg-link text-surface' : 'border-input'
                      }`}
                      aria-hidden="true"
                    >
                      {on && <Icon name="check" size={14} strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
            {form.channels.length === 0 && (
              <p className="mt-4 text-sm font-semibold text-error" role="alert">
                Pick at least one channel
              </p>
            )}
          </fieldset>
        )}

        {/* Save bar, at the bottom of every tab */}
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-sm sm:mr-auto" role="status">
            {status === 'saving' ? (
              <span className="text-muted">Saving…</span>
            ) : status === 'error' || dirty ? (
              <span className="font-semibold text-error">Unsaved changes</span>
            ) : profile?.updated_at ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <Icon name="check" size={16} /> Saved {formatSavedAt(profile.updated_at)}
              </span>
            ) : null}
          </p>
          <button type="button" className="btn-accent" onClick={saveAll} disabled={status === 'saving'}>
            {status === 'saving' ? <Spinner size={16} /> : <Icon name="check" size={18} />}
            Save brand profile
          </button>
        </div>
      </section>

      <div className="mt-6 flex justify-between gap-3">
        {TABS.findIndex((t) => t.key === tab) > 0 ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setParams({ tab: TABS[TABS.findIndex((t) => t.key === tab) - 1].key }, { replace: true })}
          >
            <Icon name="chevronLeft" size={18} /> Back
          </button>
        ) : (
          <span />
        )}
        {TABS.findIndex((t) => t.key === tab) < TABS.length - 1 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setParams({ tab: TABS[TABS.findIndex((t) => t.key === tab) + 1].key }, { replace: true })}
          >
            Next <Icon name="chevronRight" size={18} />
          </button>
        )}
      </div>

      {blocker.state === 'blocked' && (
        <Modal onClose={() => blocker.reset()} labelledBy="leave-title" width={440} role="alertdialog">
          <div className="p-6">
            <h2 id="leave-title" className="text-lg">
              Leave without saving?
            </h2>
            <p className="mt-2">Some changes to your brand profile haven't been saved yet.</p>
            {leaveError && <p className="mt-3 text-sm font-medium text-error">{leaveError}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => blocker.proceed()}>
                Leave
              </button>
              <button type="button" className="btn-accent" autoFocus onClick={saveAndLeave} disabled={status === 'saving'}>
                {status === 'saving' && <Spinner size={16} />} Save and leave
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}
