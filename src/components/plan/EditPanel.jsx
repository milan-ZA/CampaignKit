import { useConfirm } from '../../context/ConfirmContext'
import { addDays } from '../../lib/dates'
import Icon from '../Icon'
import { ChannelPill, SaveStatus, Spinner } from '../ui'
import AssetSection from './AssetSection'
import ImagesSection from './ImagesSection'

export default function EditPanel({
  item,
  campaign,
  images,
  imageJob,
  businessName,
  saveStatus,
  deleting,
  onChange,
  onBlurField,
  onRetrySave,
  onClose,
  onPreview,
  onDelete,
  onGenerateAsset,
  onGenerateImages,
  onDeleteImage,
}) {
  const confirm = useConfirm()

  // The campaign's channels, plus the post's current channel if it's no longer one of them.
  const channelOptions = campaign.channels.includes(item.channel) ? campaign.channels : [...campaign.channels, item.channel]
  const minDate = campaign.start_date
  const maxDate = addDays(campaign.start_date, campaign.duration_weeks * 7 - 1)

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this post?',
      message: 'The post, its ad script, creative brief and images will be deleted. You can’t undo this.',
      confirmLabel: 'Delete post',
      danger: true,
    })
    if (ok) onDelete()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <ChannelPill channel={item.channel} />
        <button type="button" className="btn-secondary min-h-10 px-3" onClick={onPreview}>
          <Icon name="eye" size={16} /> Preview
        </button>
        <button type="button" className="btn-icon ml-auto -mr-2" aria-label="Close edit panel" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pt-4 pb-8">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <h2 className="text-lg">Edit post</h2>
          <SaveStatus status={saveStatus} onRetry={onRetrySave} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="post-date" className="label">
              Date
            </label>
            <input
              id="post-date"
              type="date"
              className="input mt-1.5"
              min={minDate}
              max={maxDate}
              value={item.post_date}
              onChange={(e) => e.target.value && onChange('post_date', e.target.value)}
              onBlur={() => onBlurField('post_date')}
            />
          </div>
          <div>
            <label htmlFor="post-channel" className="label">
              Channel
            </label>
            <select
              id="post-channel"
              className="input mt-1.5"
              value={item.channel}
              onChange={(e) => onChange('channel', e.target.value)}
              onBlur={() => onBlurField('channel')}
            >
              {channelOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {campaign.channels.includes(c) ? '' : ' (not in this campaign)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="post-idea" className="label">
            Content idea
          </label>
          <input
            id="post-idea"
            className="input mt-1.5"
            maxLength={300}
            value={item.content_idea}
            onChange={(e) => onChange('content_idea', e.target.value)}
            onBlur={() => onBlurField('content_idea')}
          />
          <p className="hint">A short title for the post. Used as the subject line for emails.</p>
        </div>

        <div>
          <label htmlFor="post-copy" className="label">
            Copy
          </label>
          <textarea
            id="post-copy"
            className="input mt-1.5 resize-y leading-relaxed"
            rows={8}
            maxLength={5000}
            value={item.copy}
            onChange={(e) => onChange('copy', e.target.value)}
            onBlur={() => onBlurField('copy')}
          />
          <p className="hint">The words people will read. Edit it until it sounds like you.</p>
        </div>

        <AssetSection
          title="Creative brief"
          description="A short brief for a designer, or for you, on how the image should look."
          text={item.creative_brief}
          onGenerate={() => onGenerateAsset('creative_brief')}
        />

        <AssetSection
          title="Ad script"
          description="A 15 to 30-second script for a video or audio ad, with timings."
          text={item.ad_script}
          onGenerate={() => onGenerateAsset('ad_script')}
        />

        <ImagesSection
          item={item}
          images={images}
          job={imageJob}
          businessName={businessName}
          onGenerate={onGenerateImages}
          onDeleteImage={onDeleteImage}
        />

        <div className="border-t border-border pt-5">
          <button type="button" className="btn-danger w-full" onClick={remove} disabled={deleting}>
            {deleting ? <Spinner size={16} /> : <Icon name="trash" size={16} />}
            {deleting ? 'Deleting…' : 'Delete post'}
          </button>
        </div>
      </div>
    </div>
  )
}
