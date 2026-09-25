import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import EditPanel from '../components/plan/EditPanel'
import PostCard from '../components/plan/PostCard'
import PostPreview from '../components/plan/PostPreview'
import { ChannelPill, ErrorState, InlineError, LoadingState, Spinner } from '../components/ui'
import { useBrand } from '../context/BrandContext'
import { callFunction, deleteItem, loadImagesForItems, removeImageFiles } from '../lib/api'
import { addDays, formatDate, formatRange, weekForDate, weekRange } from '../lib/dates'
import { supabase } from '../lib/supabase'

const EDITABLE = ['post_date', 'channel', 'content_idea', 'copy']

const byPlanOrder = (a, b) =>
  a.week_number - b.week_number ||
  a.post_date.localeCompare(b.post_date) ||
  String(a.created_at).localeCompare(String(b.created_at))

function planAsText(campaign, items) {
  const lines = [campaign.name, '']
  for (let w = 1; w <= campaign.duration_weeks; w++) {
    const { from, to } = weekRange(campaign.start_date, w)
    lines.push(`Week ${w} (${formatRange(from, to)})`)
    const posts = items.filter((i) => i.week_number === w)
    if (!posts.length) lines.push('- No posts')
    for (const p of posts) {
      const copy = (p.copy ?? '').replace(/\s*\n+\s*/g, ' ').trim()
      lines.push(`- ${formatDate(p.post_date, { weekday: 'short', day: 'numeric', month: 'short' })} | ${p.channel} | ${p.content_idea} | ${copy}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

export default function CampaignPlanPage() {
  const { id } = useParams()
  const { profile } = useBrand()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('post')

  const [campaign, setCampaign] = useState(null)
  const [items, setItems] = useState([])
  const [images, setImages] = useState({}) // itemId -> [image]
  const [imageJobs, setImageJobs] = useState({}) // itemId -> { status, error }
  const [loadState, setLoadState] = useState('loading') // loading | ready | error | missing
  const [saveStatus, setSaveStatus] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [adding, setAdding] = useState(null)
  const [boardError, setBoardError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [copied, setCopied] = useState(false)

  const itemsRef = useRef(items)
  itemsRef.current = items
  const savedRef = useRef({}) // itemId -> last saved editable values
  const failedSave = useRef(null)

  const businessName = profile?.business_name || 'Your business'

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const [{ data: c, error: ce }, { data: its, error: ie }] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('campaign_items')
          .select('*')
          .eq('campaign_id', id)
          .order('week_number')
          .order('post_date')
          .order('created_at'),
      ])
      if (ce || ie) throw ce || ie
      if (!c) return setLoadState('missing')
      const imgs = await loadImagesForItems(its.map((i) => i.id))
      savedRef.current = Object.fromEntries(its.map((i) => [i.id, pickEditable(i)]))
      setCampaign(c)
      setItems(its)
      setImages(imgs)
      setLoadState('ready')
    } catch (err) {
      console.error(err)
      setLoadState('error')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const sorted = useMemo(() => [...items].sort(byPlanOrder), [items])
  const selected = items.find((i) => i.id === selectedId) ?? null
  const previewItem = items.find((i) => i.id === previewId) ?? null

  const select = (itemId) => {
    const next = new URLSearchParams(params)
    if (itemId) next.set('post', itemId)
    else next.delete('post')
    setParams(next, { replace: true })
  }

  // ---- Editing ---------------------------------------------------------------

  const patchLocal = (itemId, patch) =>
    setItems((list) => list.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))

  const saveField = async (itemId, field, value) => {
    const item = itemsRef.current.find((i) => i.id === itemId)
    if (!item) return
    const v = value ?? item[field]
    const saved = savedRef.current[itemId] ?? {}
    const isRetry = failedSave.current?.itemId === itemId && failedSave.current?.field === field
    if (saved[field] === v && !isRetry) return

    const patch = { [field]: v }
    if (field === 'post_date') {
      const last = addDays(campaign.start_date, campaign.duration_weeks * 7 - 1)
      if (!v || v < campaign.start_date || v > last) {
        // Outside the campaign: put the saved date back.
        patchLocal(itemId, { post_date: saved.post_date, week_number: weekForDate(campaign.start_date, saved.post_date) })
        return
      }
      patch.week_number = weekForDate(campaign.start_date, v)
    }

    setSaveStatus('saving')
    const { error } = await supabase.from('campaign_items').update(patch).eq('id', itemId)
    if (error) {
      failedSave.current = { itemId, field }
      setSaveStatus('error')
      return
    }
    if (isRetry) failedSave.current = null
    savedRef.current[itemId] = { ...saved, ...patch }
    setSaveStatus('saved')
  }

  const change = (field, value) => {
    const patch = { [field]: value }
    if (field === 'post_date') patch.week_number = weekForDate(campaign.start_date, value)
    patchLocal(selected.id, patch)
    // Dropdown and date picker have no natural "leave the field" moment, so save straight away.
    if (field === 'channel' || field === 'post_date') saveField(selected.id, field, value)
  }

  const retrySave = () => {
    if (failedSave.current) saveField(failedSave.current.itemId, failedSave.current.field)
  }

  // ---- Posts -----------------------------------------------------------------

  const addItem = async (week) => {
    setAdding(week)
    setBoardError(null)
    const { data, error } = await supabase
      .from('campaign_items')
      .insert({
        campaign_id: campaign.id,
        week_number: week,
        post_date: weekRange(campaign.start_date, week).from,
        channel: campaign.channels[0],
        content_idea: 'New post',
        copy: '',
      })
      .select()
      .single()
    setAdding(null)
    if (error) return setBoardError({ message: "We couldn't add a post.", retry: () => addItem(week) })
    savedRef.current[data.id] = pickEditable(data)
    setItems((list) => [...list, data])
    select(data.id)
  }

  const removeItem = async (itemId) => {
    setDeletingId(itemId)
    setBoardError(null)
    try {
      await deleteItem(itemId)
      setItems((list) => list.filter((i) => i.id !== itemId))
      setImages(({ [itemId]: _removed, ...rest }) => rest)
      if (selectedId === itemId) select(null)
    } catch {
      setBoardError({ message: "We couldn't delete that post.", retry: () => removeItem(itemId) })
    } finally {
      setDeletingId(null)
    }
  }

  // ---- AI --------------------------------------------------------------------

  const generateAsset = async (itemId, type) => {
    const { text } = await callFunction('generate-asset', { item_id: itemId, type })
    patchLocal(itemId, { [type]: text })
  }

  const generateImages = async (itemId) => {
    if (imageJobs[itemId]?.status === 'loading') return
    setImageJobs((j) => ({ ...j, [itemId]: { status: 'loading' } }))
    try {
      const { images: rows } = await callFunction('generate-images', { item_id: itemId })
      setImages((m) => ({ ...m, [itemId]: rows }))
      setImageJobs(({ [itemId]: _done, ...rest }) => rest)
    } catch (err) {
      setImageJobs((j) => ({ ...j, [itemId]: { status: 'error', error: err.message } }))
    }
  }

  const deleteImage = async (itemId, image) => {
    const { error } = await supabase.from('campaign_item_images').delete().eq('id', image.id)
    if (error) throw error
    await removeImageFiles([image.storage_path])
    setImages((m) => ({ ...m, [itemId]: (m[itemId] ?? []).filter((i) => i.id !== image.id) }))
  }

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(planAsText(campaign, sorted))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setBoardError({ message: "We couldn't copy the plan. Your browser may have blocked it." })
    }
  }

  // ---- Render ----------------------------------------------------------------

  if (loadState === 'loading') return <LoadingState message="Loading your plan…" />
  if (loadState === 'error') {
    return (
      <main className="px-4 py-12">
        <ErrorState message="We couldn't load this plan." onRetry={load} />
      </main>
    )
  }
  if (loadState === 'missing') {
    return (
      <main className="px-4 py-12">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-xl">We couldn't find this campaign</h1>
          <p className="mt-2">It may have been deleted.</p>
          <Link to="/" className="btn-secondary mt-5">
            Back to all campaigns
          </Link>
        </div>
      </main>
    )
  }

  const end = addDays(campaign.start_date, campaign.duration_weeks * 7 - 1)
  const manyWeeks = campaign.duration_weeks > 4
  const weeks = Array.from({ length: campaign.duration_weeks }, (_, i) => i + 1)

  return (
    <div className="flex flex-1 flex-col">
      {/* Summary strip */}
      <div className="border-b border-border bg-surface">
        <div className="px-4 pt-2 pb-4 sm:px-6">
          <Link to="/" className="link inline-flex min-h-11 items-center gap-1.5 text-sm">
            <Icon name="arrowLeft" size={16} /> All campaigns
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-2xl break-words sm:text-[28px]">{campaign.name}</h1>
            <button type="button" className="btn-secondary" onClick={copyPlan}>
              <Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Copied' : 'Copy plan'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip">
              <span className="text-muted">Audience:</span> {campaign.target_audience}
            </span>
            <span className="chip">
              <span className="text-muted">Goal:</span> {campaign.goal}
            </span>
            <span className="chip">
              <Icon name="calendar" size={14} className="text-muted" /> {formatRange(campaign.start_date, end)}
            </span>
            {campaign.channels.map((ch) => (
              <ChannelPill key={ch} channel={ch} className="py-1 text-[13px]" />
            ))}
          </div>
        </div>
      </div>

      {boardError && (
        <div className="px-4 pt-4 sm:px-6">
          <InlineError message={boardError.message} onRetry={boardError.retry} />
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-start">
        {/* Board */}
        <div className="min-w-0 flex-1 overflow-x-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 wide:flex-row wide:items-start">
            {weeks.map((w) => {
              const { from, to } = weekRange(campaign.start_date, w)
              const posts = sorted.filter((i) => i.week_number === w)
              return (
                <section
                  key={w}
                  aria-label={`Week ${w}`}
                  className={`flex flex-col rounded-2xl bg-week p-3 ${
                    manyWeeks ? 'wide:w-[280px] wide:shrink-0' : 'wide:min-w-[240px] wide:flex-1'
                  }`}
                >
                  <header className="mb-3 px-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-base">Week {w}</h2>
                      <span className="text-xs font-semibold text-muted">
                        {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                      </span>
                    </div>
                    <p className="text-xs text-muted">{formatRange(from, to)}</p>
                  </header>
                  <div className="flex flex-col gap-2.5">
                    {posts.map((item) => (
                      <PostCard
                        key={item.id}
                        item={item}
                        thumbnail={images[item.id]?.[0]?.url}
                        hasImages={(images[item.id]?.length ?? 0) > 0}
                        selected={item.id === selectedId}
                        onSelect={() => select(item.id)}
                        onPreview={() => setPreviewId(item.id)}
                      />
                    ))}
                    {posts.length === 0 && (
                      <p className="rounded-xl border border-dashed border-input px-3 py-5 text-center text-sm text-muted">
                        No posts this week yet.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost mt-2 w-full text-muted"
                    onClick={() => addItem(w)}
                    disabled={adding === w}
                  >
                    {adding === w ? <Spinner size={16} /> : <Icon name="plus" size={16} />} Add item
                  </button>
                </section>
              )
            })}
          </div>
        </div>

        {/* Edit panel: right-hand column on wide screens, full screen below 900px */}
        {selected && (
          <aside
            aria-label="Edit post"
            className="fixed inset-0 z-[45] bg-surface wide:sticky wide:top-16 wide:z-auto wide:h-[calc(100dvh-4rem)] wide:w-[420px] wide:shrink-0 wide:border-l wide:border-border"
          >
            <EditPanel
              key={selected.id}
              item={selected}
              campaign={campaign}
              images={images[selected.id] ?? []}
              imageJob={imageJobs[selected.id]}
              businessName={businessName}
              saveStatus={saveStatus}
              deleting={deletingId === selected.id}
              onChange={change}
              onBlurField={(field) => saveField(selected.id, field)}
              onRetrySave={retrySave}
              onClose={() => select(null)}
              onPreview={() => setPreviewId(selected.id)}
              onDelete={() => removeItem(selected.id)}
              onGenerateAsset={(type) => generateAsset(selected.id, type)}
              onGenerateImages={() => generateImages(selected.id)}
              onDeleteImage={(image) => deleteImage(selected.id, image)}
            />
          </aside>
        )}
      </div>

      {previewItem && (
        <PostPreview
          item={previewItem}
          images={images[previewItem.id] ?? []}
          businessName={businessName}
          job={imageJobs[previewItem.id]}
          onGenerateImages={() => generateImages(previewItem.id)}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  )
}

function pickEditable(item) {
  return Object.fromEntries([...EDITABLE, 'week_number'].map((k) => [k, item[k]]))
}
