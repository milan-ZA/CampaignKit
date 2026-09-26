import { useState } from 'react'
import { useConfirm } from '../../context/ConfirmContext'
import Icon from '../Icon'
import { CopyForApp, InlineError, Spinner } from '../ui'

/** Creative brief / Ad script: shows saved text with Regenerate, or a Generate button when empty. */
export default function AssetSection({ title, description, text, onGenerate }) {
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await onGenerate()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async () => {
    const ok = await confirm({
      title: `Replace this ${title.toLowerCase()}?`,
      message: `We'll write a new ${title.toLowerCase()} and the current one will be replaced.`,
      confirmLabel: 'Regenerate',
    })
    if (ok) run()
  }

  return (
    <section className="border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base">{title}</h3>
        {text && !busy && (
          <button type="button" className="btn-ghost min-h-10 px-3" onClick={regenerate}>
            <Icon name="repost" size={16} /> Regenerate
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-muted">{description}</p>

      {busy ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner size={16} /> Writing your {title.toLowerCase()}…
        </p>
      ) : text ? (
        <>
          <div className="mt-3 rounded-lg border border-border bg-week p-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-body">
            {text}
          </div>
          <CopyForApp text={text} />
        </>
      ) : (
        <button type="button" className="btn-accent mt-3" onClick={run}>
          <Icon name="sparkle" size={16} /> Generate
        </button>
      )}

      {error && (
        <div className="mt-3">
          <InlineError message={error} onRetry={run} />
        </div>
      )}
    </section>
  )
}
