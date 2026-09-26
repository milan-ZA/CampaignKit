import { useEffect, useRef, useState } from 'react'
import { useConfirm } from '../context/ConfirmContext'
import { IMAGE_BUCKET, supabase } from '../lib/supabase'
import Icon from './Icon'
import { InlineError, Spinner } from './ui'

const MAX_BYTES = 2 * 1024 * 1024
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

/**
 * Company logo on the brand profile. The file goes to the private images bucket under
 * {user_id}/brand/, where the storage rules only let each user reach their own folder.
 * onSave(path | null) stores the path on the profile and resolves to true on success.
 */
export default function LogoUpload({ userId, path, onSave }) {
  const confirm = useConfirm()
  const inputRef = useRef(null)
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Show a preview of the saved logo (signed link, valid for 1 hour).
  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      return
    }
    supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => !cancelled && setUrl(data?.signedUrl ?? null))
    return () => {
      cancelled = true
    }
  }, [path])

  const upload = async (file) => {
    setError(null)
    if (!file) return
    const ext = TYPES[file.type]
    if (!ext) return setError('Please choose a PNG, JPG or WebP image.')
    if (file.size > MAX_BYTES) return setError('Please choose an image under 2 MB.')

    setBusy(true)
    const newPath = `${userId}/brand/logo-${crypto.randomUUID()}.${ext}`
    const { error: upError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(newPath, file, { contentType: file.type, upsert: false })
    if (upError) {
      setBusy(false)
      return setError("We couldn't upload your logo. Please try again.")
    }
    const ok = await onSave(newPath)
    if (!ok) {
      await supabase.storage.from(IMAGE_BUCKET).remove([newPath])
      setBusy(false)
      return setError("We couldn't save your logo. Please try again.")
    }
    // The new logo is saved, so the old file can go.
    if (path) await supabase.storage.from(IMAGE_BUCKET).remove([path])
    setBusy(false)
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Remove your logo?',
      message: 'You can upload it again at any time.',
      confirmLabel: 'Remove logo',
      danger: true,
    })
    if (!ok) return
    setError(null)
    setBusy(true)
    if (await onSave(null)) await supabase.storage.from(IMAGE_BUCKET).remove([path])
    else setError("We couldn't remove your logo. Please try again.")
    setBusy(false)
  }

  return (
    <div>
      <p className="label">Company logo</p>
      <p className="hint">Optional. PNG, JPG or WebP, up to 2 MB.</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-week">
          {busy ? (
            <Spinner size={20} />
          ) : url ? (
            <img src={url} alt="Your company logo" className="size-full object-contain p-2" />
          ) : (
            <Icon name="image" size={28} className="text-muted" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Icon name="plus" size={18} /> {path ? 'Replace logo' : 'Upload logo'}
          </button>
          {path && (
            <button type="button" className="btn-ghost hover:text-error" onClick={remove} disabled={busy}>
              <Icon name="trash" size={18} /> Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            upload(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      )}
    </div>
  )
}
