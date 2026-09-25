import { formatDate } from '../../lib/dates'
import Icon from '../Icon'
import { ChannelPill } from '../ui'

function Tick({ label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
      <Icon name="check" size={12} strokeWidth={3} /> {label}
    </span>
  )
}

export default function PostCard({ item, thumbnail, hasImages, selected, onSelect, onPreview }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={`group relative overflow-hidden rounded-xl border bg-card text-left shadow-card transition ${
        selected ? 'border-link outline-2 outline-link' : 'border-border hover:border-input'
      }`}
    >
      {thumbnail && <img src={thumbnail} alt="" className="h-24 w-full object-cover" loading="lazy" />}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <ChannelPill channel={item.channel} className="max-w-[60%] truncate" />
          <span className="text-xs font-medium text-muted">
            {formatDate(item.post_date, { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <button
            type="button"
            className="-my-2 -mr-2 ml-auto flex size-11 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-heading"
            aria-label="Preview post"
            title="Preview"
            onClick={(e) => {
              e.stopPropagation()
              onPreview()
            }}
          >
            <Icon name="eye" size={18} />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-snug font-bold text-heading">{item.content_idea || 'Untitled post'}</p>
        {item.copy ? (
          <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-body">{item.copy}</p>
        ) : (
          <p className="mt-1 text-[13px] text-muted italic">No copy yet</p>
        )}
        {(item.ad_script || item.creative_brief || hasImages) && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {item.ad_script && <Tick label="Ad script" />}
            {item.creative_brief && <Tick label="Creative brief" />}
            {hasImages && <Tick label="Images" />}
          </div>
        )}
      </div>
    </div>
  )
}
