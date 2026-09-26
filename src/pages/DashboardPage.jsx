import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { ErrorState, InlineError, LoadingState, Spinner, ToneChips } from '../components/ui'
import { useBrand } from '../context/BrandContext'
import { useConfirm } from '../context/ConfirmContext'
import { deleteCampaign, describeDbError } from '../lib/api'
import { formatTimestamp } from '../lib/dates'
import { useRemoveDemo } from '../lib/demo'
import { supabase } from '../lib/supabase'

export default function DashboardPage() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { profile, ready, loading: brandLoading } = useBrand()
  const [campaigns, setCampaigns] = useState(null)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  // A short confirmation after saving the brand profile. Clear the router state so a refresh doesn't show it again.
  const location = useLocation()
  const [flash, setFlash] = useState(location.state?.brandSaved ?? null)
  useEffect(() => {
    if (!location.state?.brandSaved) return
    navigate('.', { replace: true, state: null })
    const t = setTimeout(() => setFlash(null), 6000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setError(null)
    setCampaigns(null)
    const { data, error: err } = await supabase
      .from('campaigns')
      .select('id, name, goal, duration_weeks, created_at, campaign_items(count)')
      .order('created_at', { ascending: false })
    if (err) setError(describeDbError(err, "We couldn't load your campaigns."))
    else setCampaigns(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // "Remove demo": clear the demo, then start the real brand profile set-up on About you.
  const { removeDemo, busy: removingDemo, error: removeDemoError } = useRemoveDemo()
  const removeDemoAndSetUp = async (opts) => {
    if (await removeDemo(opts)) navigate('/brand?tab=about')
  }

  // Without a brand profile (with channels), "new campaign" buttons go to the profile instead.
  const newCampaignPath = ready ? '/campaigns/new' : '/brand'
  const startNew = () => navigate(newCampaignPath)

  const remove = async (campaign) => {
    const ok = await confirm({
      title: 'Delete this campaign?',
      message: `"${campaign.name}" and all its posts and images will be deleted. You can't undo this.`,
      confirmLabel: 'Delete campaign',
      danger: true,
    })
    if (!ok) return
    setDeleting(campaign.id)
    setDeleteError(null)
    try {
      await deleteCampaign(campaign.id)
      setCampaigns((list) => list.filter((c) => c.id !== campaign.id))
    } catch {
      setDeleteError({ message: "We couldn't delete that campaign.", campaign })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Your campaigns</h1>
        {campaigns?.length > 0 && (
          <button type="button" className="btn-accent" onClick={startNew} disabled={brandLoading}>
            <Icon name="plus" size={18} /> New campaign
          </button>
        )}
      </div>

      {flash && (
        <div
          className="mt-6 flex items-center gap-2 rounded-xl border border-success bg-success-soft px-4 py-3 text-sm font-medium text-success"
          role="status"
        >
          <Icon name="check" size={18} />
          {flash === 'demo'
            ? 'Demo profile loaded. Start a campaign to see how CampaignKit works.'
            : flash === 'first'
              ? 'Your brand profile is ready. Start your first campaign.'
              : 'Brand profile saved.'}
        </div>
      )}

      {!brandLoading && profile?.is_demo && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center">
          <p className="flex-1 font-medium text-heading">You're using demo data (Sunrise Bakery).</p>
          <button type="button" className="btn-danger" onClick={removeDemoAndSetUp} disabled={removingDemo}>
            {removingDemo ? <Spinner size={16} /> : <Icon name="trash" size={16} />}
            {removingDemo ? 'Removing…' : 'Remove demo'}
          </button>
        </div>
      )}
      {removeDemoError && (
        <div className="mt-3">
          <InlineError message={removeDemoError} onRetry={() => removeDemoAndSetUp({ skipConfirm: true })} />
        </div>
      )}

      {!brandLoading && !ready && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-link bg-link-soft p-5 sm:flex-row sm:items-center">
          <p className="flex-1 font-medium text-heading">
            Set up your brand profile first so your plans sound like you and use your channels.
          </p>
          <Link to="/brand" className="btn-secondary">
            Set up brand profile
          </Link>
        </div>
      )}

      {!brandLoading && ready && (
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
          <span className="font-medium text-muted">Plans use your saved brand voice:</span>
          <ToneChips words={profile.tone_words} />
          <span className="font-semibold text-heading">{profile.business_name}</span>
          <Link to="/brand" className="link ml-auto inline-flex min-h-11 items-center">
            Edit brand profile
          </Link>
        </div>
      )}

      {deleteError && (
        <div className="mt-6">
          <InlineError message={deleteError.message} onRetry={() => remove(deleteError.campaign)} />
        </div>
      )}

      <div className="mt-8">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !campaigns ? (
          <LoadingState message="Loading your campaigns…" />
        ) : campaigns.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-week text-muted">
              <Icon name="calendar" size={26} />
            </span>
            <h2 className="mt-5 text-xl">No campaigns yet</h2>
            <p className="mt-2 max-w-md text-body">
              Describe what you want to promote and we'll build a week-by-week plan with ready-to-post content.
            </p>
            <button type="button" className="btn-accent mt-6" onClick={startNew} disabled={brandLoading}>
              Create your first campaign
            </button>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const posts = c.campaign_items?.[0]?.count ?? 0
              return (
                <li key={c.id} className="card flex flex-col p-5">
                  <div className="flex items-start gap-2">
                    <h2 className="line-clamp-2 flex-1 text-lg">{c.name}</h2>
                    <button
                      type="button"
                      className="btn-icon -mr-2 -mt-2 hover:text-error"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => remove(c)}
                      disabled={deleting === c.id}
                    >
                      {deleting === c.id ? <Spinner size={18} /> : <Icon name="trash" size={18} />}
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-body">{c.goal}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="pill bg-week text-body">
                      {c.duration_weeks} {c.duration_weeks === 1 ? 'week' : 'weeks'}
                    </span>
                    <span className="pill bg-week text-body">
                      {posts} {posts === 1 ? 'post' : 'posts'}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <span className="text-[13px] text-muted">Created {formatTimestamp(c.created_at)}</span>
                    <Link to={`/campaigns/${c.id}`} className="btn-secondary">
                      Open plan
                    </Link>
                  </div>
                </li>
              )
            })}
            <li>
              <button
                type="button"
                onClick={startNew}
                disabled={brandLoading}
                className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-input p-5 font-semibold text-muted transition-colors hover:border-link hover:text-link"
              >
                <Icon name="plus" size={28} />
                Start a new campaign
              </button>
            </li>
          </ul>
        )}
      </div>
    </main>
  )
}
