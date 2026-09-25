import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { ErrorState, Field, LoadingState, Spinner, ToneChips } from '../components/ui'
import { useBrand } from '../context/BrandContext'
import { callFunction } from '../lib/api'
import { channelColors } from '../lib/channels'
import { todayISO } from '../lib/dates'

const BRIEF_MAX = 1000

const DEMO_BRIEF = {
  name: 'Sunrise Bakery winter lunch launch',
  business_brief: 'Sunrise Bakery is a local bakery café launching a new winter soup-and-bread lunch menu.',
  target_audience: 'Office workers aged 25 to 45 within 5 km',
  goal: 'Get 200 lunch orders for the new winter menu',
  duration_weeks: 4,
}

export default function NewCampaignPage() {
  const navigate = useNavigate()
  const { profile, ready, loading, error: brandError, reload } = useBrand()
  const [form, setForm] = useState({
    name: '',
    business_brief: '',
    target_audience: '',
    goal: '',
    duration_weeks: 4,
    start_date: todayISO(),
  })
  const [selected, setSelected] = useState(null) // null = all brand channels
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (loading) return <LoadingState />
  if (brandError) {
    return (
      <main className="px-4 py-12">
        <ErrorState message={brandError} onRetry={reload} />
      </main>
    )
  }
  if (!ready) return <Navigate to="/brand?tab=channels" replace />

  const brandChannels = profile.channels
  const channels = (selected ?? brandChannels).filter((c) => brandChannels.includes(c))
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const toggleChannel = (ch) => {
    if (channels.includes(ch)) {
      if (channels.length === 1) return // at least one must stay ticked
      setSelected(channels.filter((c) => c !== ch))
    } else {
      setSelected(brandChannels.filter((c) => c === ch || channels.includes(c)))
    }
  }

  const weeks = Number(form.duration_weeks)
  const weeksValid = Number.isInteger(weeks) && weeks >= 1 && weeks <= 12
  const canSubmit =
    form.name.trim() &&
    form.business_brief.trim() &&
    form.target_audience.trim() &&
    form.goal.trim() &&
    form.start_date &&
    weeksValid &&
    channels.length > 0

  const generate = async (e) => {
    e?.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError(null)
    try {
      const { campaign_id } = await callFunction('generate-plan', {
        ...form,
        duration_weeks: weeks,
        channels,
      })
      navigate(`/campaigns/${campaign_id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <Link to="/" className="link inline-flex min-h-11 items-center gap-1.5 text-sm">
        <Icon name="arrowLeft" size={16} /> All campaigns
      </Link>

      <form onSubmit={generate} className="card mt-2 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">New campaign</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted">
              <span>
                Using your saved brand profile:{' '}
                <strong className="text-heading">{profile.business_name || 'Your business'}</strong>
              </span>
              <ToneChips words={profile.tone_words} />
              <Link to="/brand" className="link">
                Edit
              </Link>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => {
              setForm((f) => ({ ...f, ...DEMO_BRIEF }))
              setError(null)
            }}
          >
            Use demo brief
          </button>
        </div>

        <fieldset disabled={busy} className="mt-7 space-y-6">
          <Field
            id="name"
            label="Campaign name"
            example="Example: Spring bike service special"
            required
            maxLength={120}
            value={form.name}
            onChange={set('name')}
          />
          <Field
            id="business_brief"
            label="What is this campaign about?"
            example="Example: We're offering a full bike service for 20% less during September."
            required
            multiline
            rows={4}
            maxLength={BRIEF_MAX}
            value={form.business_brief}
            onChange={set('business_brief')}
          />
          <Field
            id="target_audience"
            label="Who do you want to reach?"
            example="Example: Students and commuters who cycle to work"
            required
            maxLength={300}
            value={form.target_audience}
            onChange={set('target_audience')}
          />
          <Field
            id="goal"
            label="What do you want to achieve?"
            example="Example: Book 50 services this month"
            required
            maxLength={300}
            value={form.goal}
            onChange={set('goal')}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              id="duration_weeks"
              label="How many weeks?"
              example="From 1 to 12 weeks."
              required
              type="number"
              min={1}
              max={12}
              step={1}
              inputMode="numeric"
              value={String(form.duration_weeks)}
              onChange={set('duration_weeks')}
            />
            <Field
              id="start_date"
              label="Start date"
              example="Week 1 starts on this day."
              required
              type="date"
              value={form.start_date}
              onChange={set('start_date')}
            />
          </div>
          {!weeksValid && String(form.duration_weeks) !== '' && (
            <p className="-mt-3 text-sm font-medium text-error">Please choose between 1 and 12 weeks.</p>
          )}

          <fieldset>
            <legend className="label">Channels for this campaign</legend>
            <p className="hint">Untick any you don't want to use this time. At least one must stay ticked.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {brandChannels.map((ch) => {
                const on = channels.includes(ch)
                return (
                  <button
                    key={ch}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleChannel(ch)}
                    title={on && channels.length === 1 ? 'At least one channel must stay ticked' : undefined}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition ${
                      on ? 'border-link' : 'border-transparent opacity-55 hover:opacity-80'
                    }`}
                    style={channelColors(ch)}
                  >
                    <span
                      className={`flex size-5 items-center justify-center rounded-full border-2 border-current ${
                        on ? '' : 'opacity-60'
                      }`}
                      aria-hidden="true"
                    >
                      {on && <Icon name="check" size={12} strokeWidth={3.5} />}
                    </span>
                    {ch}
                  </button>
                )
              })}
            </div>
            <p className="hint mt-3">
              Want another channel?{' '}
              <Link to="/brand?tab=channels" className="link">
                Add it in your Brand profile.
              </Link>
            </p>
          </fieldset>
        </fieldset>

        {error && (
          <div className="mt-6 rounded-xl border border-error bg-error-soft p-4" role="alert">
            <p className="font-semibold text-error">We couldn't build your plan.</p>
            <p className="mt-1 text-sm text-error">{error}</p>
            <button type="button" className="btn-secondary mt-3" onClick={generate}>
              Try again
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          {busy && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted" role="status">
              <Spinner size={16} /> Building your plan… this can take up to a minute.
            </p>
          )}
          <button type="submit" className="btn-accent px-6" disabled={!canSubmit || busy}>
            {busy ? <Spinner size={16} /> : <Icon name="sparkle" size={18} />}
            {busy ? 'Building your plan…' : 'Generate plan'}
          </button>
        </div>
      </form>
    </main>
  )
}
