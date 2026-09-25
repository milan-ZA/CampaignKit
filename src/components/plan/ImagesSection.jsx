import { useState } from 'react'
import { useConfirm } from '../../context/ConfirmContext'
import { downloadFile, slugify } from '../../lib/api'
import { ASPECT_CLASS, channelInfo } from '../../lib/channels'
import Icon from '../Icon'
import Modal from '../Modal'
import { InlineError, Spinner } from '../ui'

export default function ImagesSection({ item, images, job, businessName, onGenerate, onDeleteImage }) {
  const confirm = useConfirm()
  const [open, setOpen] = useState(null) // image shown full size
  const [actionError, setActionError] = useState(null)
  const info = channelInfo(item.channel)
  const loading = job?.status === 'loading'
  const aspect = ASPECT_CLASS[info.shape]

  const regenerate = async () => {
    const ok = await confirm({
      title: 'Replace all images?',
      message: 'We will create 3 new images. Your current images will be deleted once the new ones are ready.',
      confirmLabel: 'Regenerate images',
    })
    if (ok) onGenerate()
  }

  const remove = async (image) => {
    const ok = await confirm({
      title: 'Delete this image?',
      message: "You can't undo this.",
      confirmLabel: 'Delete image',
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    try {
      await onDeleteImage(image)
      if (open?.id === image.id) setOpen(null)
    } catch {
      setActionError("We couldn't delete that image. Please try again.")
    }
  }

  const download = async (image, n) => {
    setActionError(null)
    try {
      await downloadFile(image.url, `${slugify(businessName)}-${slugify(item.channel)}-${n}.png`)
    } catch {
      setActionError("We couldn't download that image. Please try again.")
    }
  }

  return (
    <section className="border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base">Images</h3>
        {images.length > 0 && !loading && (
          <button type="button" className="btn-ghost min-h-10 px-3" onClick={regenerate}>
            <Icon name="repost" size={16} /> Regenerate images
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-muted">
        Create 3 image options sized for {item.channel}. {info.sizeLabel}.
      </p>

      {loading ? (
        <>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
            <Spinner size={16} /> Creating your images… this takes about a minute.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${aspect} animate-soft-pulse rounded-lg bg-img-placeholder`} />
            ))}
          </div>
          <button type="button" className="btn-accent mt-3" disabled>
            <Spinner size={16} /> Generate 3 images
          </button>
        </>
      ) : images.length > 0 ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-2">
          {images.map((image, i) => (
            <li key={image.id} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(image)}
                className={`${aspect} overflow-hidden rounded-lg border border-border bg-img-placeholder`}
                aria-label={`Open image ${i + 1} full size`}
              >
                {image.url && <img src={image.url} alt="" className="size-full object-cover" loading="lazy" />}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn-secondary min-h-11 flex-1 px-2 text-xs"
                  onClick={() => download(image, i + 1)}
                >
                  <Icon name="download" size={16} /> Download
                </button>
                <button
                  type="button"
                  className="btn-icon hover:text-error"
                  aria-label={`Delete image ${i + 1}`}
                  onClick={() => remove(image)}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <button type="button" className="btn-accent mt-3" onClick={onGenerate}>
          <Icon name="image" size={16} /> Generate 3 images
        </button>
      )}

      {job?.status === 'error' && (
        <div className="mt-3">
          <InlineError message={`We couldn't create your images. ${job.error}`} onRetry={onGenerate} />
        </div>
      )}
      {actionError && (
        <div className="mt-3">
          <InlineError message={actionError} />
        </div>
      )}

      {open && (
        <Modal onClose={() => setOpen(null)} width={1100} labelledBy="image-title">
          <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
            <h2 id="image-title" className="flex-1 text-base">
              Image {images.findIndex((i) => i.id === open.id) + 1} of {images.length}
            </h2>
            <button
              type="button"
              className="btn-secondary min-h-10"
              onClick={() => download(open, images.findIndex((i) => i.id === open.id) + 1)}
            >
              <Icon name="download" size={16} /> Download
            </button>
            <button type="button" className="btn-icon -mr-2" aria-label="Close" onClick={() => setOpen(null)}>
              <Icon name="x" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            <img src={open.url} alt="" className="max-h-[78vh] w-auto max-w-full rounded-lg object-contain" />
          </div>
        </Modal>
      )}
    </section>
  )
}
