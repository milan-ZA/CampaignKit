import { useState } from 'react'
import { channelColors } from '../lib/channels'
import { formatTimestamp } from '../lib/dates'
import Icon from './Icon'

export function Spinner({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 animate-spin ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** The CampaignKit mark: calendar + sparkle. Same drawing as public/favicon.svg. */
export function LogoMark({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="242 225 800 800"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-logo-mark ${className}`}
    >
      <g stroke="currentColor" strokeWidth="67" strokeLinecap="round">
        <rect x="278.5" y="478.5" width="543" height="483" rx="72" />
        <path d="M278.5 628.5H821.5" strokeLinecap="butt" />
        <path d="M418 408V542M685 408V542" />
      </g>
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinejoin="round"
        d="M913 262A175 175 0 0 0 1033 383A175 175 0 0 0 913 505A175 175 0 0 0 796 383A175 175 0 0 0 913 262Z"
      />
    </svg>
  )
}

/** Mark + wordmark. onDark: light wordmark for the dark header and login panel. */
export function Logo({ onDark = false, size = 'md' }) {
  const big = size === 'lg'
  return (
    <span className={`inline-flex items-center gap-2 ${onDark ? 'text-on-header' : 'text-logo-text'}`}>
      <LogoMark size={big ? 44 : 32} />
      <span className={`${big ? 'text-[28px]' : 'text-xl'} font-extrabold tracking-tight`}>CampaignKit</span>
    </span>
  )
}

export function ChannelPill({ channel, className = '' }) {
  return (
    <span className={`pill ${className}`} style={channelColors(channel)}>
      {channel}
    </span>
  )
}

export function ToneChips({ words }) {
  if (!words?.length) return null
  return words.map((w) => (
    <span key={w} className="pill border border-link bg-link-soft text-link">
      {w}
    </span>
  ))
}

/** "25 Sep, 14:32" */
export function formatSavedAt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${formatTimestamp(ts).replace(/ \d{4}$/, '')}, ${time}`
}

export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-muted" role="status">
      <Spinner size={28} />
      <p>{message}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center" role="alert">
      <p className="font-semibold text-error">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

/** Inline error line with an optional "Try again" button. */
export function InlineError({ message, onRetry }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-error bg-error-soft px-3 py-2 text-sm text-error"
      role="alert"
    >
      <span className="flex-1 font-medium">{message}</span>
      {onRetry && (
        <button type="button" className="btn-secondary min-h-9 px-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

/** "Saving…" / "All changes saved" / error indicator for autosaving forms. */
export function SaveStatus({ status, onRetry }) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
        <Spinner size={14} /> Saving…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success" role="status">
        <Icon name="check" size={16} /> All changes saved
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-error" role="alert">
        We couldn't save your changes.
        {onRetry && (
          <button type="button" className="link" onClick={onRetry}>
            Try again
          </button>
        )}
      </span>
    )
  }
  return null
}

/** A labelled input or textarea with a plain-language example under it and an optional counter. */
export function Field({ id, label, example, value, onChange, onBlur, multiline, maxLength, required, type = 'text', rows = 3, ...rest }) {
  const Tag = multiline ? 'textarea' : 'input'
  const length = (value ?? '').length
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="ml-1 text-error">*</span>}
      </label>
      <Tag
        id={id}
        className={`input mt-1.5 ${multiline ? 'resize-y' : ''}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={maxLength}
        required={required}
        rows={multiline ? rows : undefined}
        type={multiline ? undefined : type}
        aria-describedby={example ? `${id}-hint` : undefined}
        {...rest}
      />
      <div className="flex items-start justify-between gap-3">
        {example ? (
          <p id={`${id}-hint`} className="hint">
            {example}
          </p>
        ) : (
          <span />
        )}
        {maxLength && multiline && (
          <p className={`hint shrink-0 tabular-nums ${length >= maxLength ? 'font-semibold text-error' : ''}`}>
            {length.toLocaleString()} / {maxLength.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}

/** A group of pill-shaped single- or multi-choice buttons. */
export function ChoiceGroup({ label, example, options, value, onChange, multiple = false, max }) {
  const selected = multiple ? value ?? [] : [value]
  const toggle = (opt) => {
    if (!multiple) return onChange(opt)
    if (selected.includes(opt)) return onChange(selected.filter((v) => v !== opt))
    if (max && selected.length >= max) return
    onChange([...selected, opt])
  }
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = selected.includes(opt)
          const blocked = multiple && !on && max && selected.length >= max
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              disabled={blocked}
              onClick={() => toggle(opt)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${
                on ? 'border-link bg-link-soft text-link' : 'border-input bg-surface text-body hover:bg-hover'
              }`}
            >
              {on && <Icon name="check" size={16} />}
              {opt}
            </button>
          )
        })}
      </div>
      {example && <p className="hint">{example}</p>}
    </fieldset>
  )
}

/** "Copy and paste into your preferred content-generating app." with a Copy button. */
export function CopyForApp({ text, label = 'Copy' }) {
  const [state, setState] = useState(null) // copied | error
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('error')
    }
    setTimeout(() => setState(null), 2000)
  }
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[13px] text-muted">
        {state === 'error'
          ? "We couldn't copy. Your browser may have blocked it."
          : 'Copy and paste into your preferred content-generating app.'}
      </p>
      <button type="button" className="btn-ghost min-h-10 px-3" onClick={copy}>
        <Icon name={state === 'copied' ? 'check' : 'copy'} size={16} /> {state === 'copied' ? 'Copied' : label}
      </button>
    </div>
  )
}
