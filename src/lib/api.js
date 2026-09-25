import { IMAGE_BUCKET, supabase } from './supabase'

/**
 * Turns a database error into a message. When the tables don't exist yet (the migration
 * hasn't been applied to this Supabase project) it says so, instead of a vague failure.
 */
export function describeDbError(error, fallback) {
  const missingTable = error?.code === 'PGRST205' || error?.code === '42P01' || /schema cache|does not exist/i.test(error?.message ?? '')
  if (missingTable) {
    return "This Supabase project isn't set up yet: the database tables are missing. Apply the migration in supabase/migrations (see README → Deploy your own copy)."
  }
  return fallback
}

/** Calls an Edge Function and turns any failure into an Error with a friendly message. */
export async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = 'Something went wrong. Please try again.'
    if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
      message = "We couldn't reach the server. Check your connection and try again."
    }
    if (error.context?.status === 404) {
      message = `The AI feature "${name}" isn't set up on this Supabase project yet. Deploy the Edge Functions (see README → Deploy your own copy).`
    }
    try {
      const payload = await error.context?.json()
      if (payload?.error) message = payload.error
    } catch {
      // keep the default message
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

const SIGNED_URL_SECONDS = 60 * 60

/** Loads the image rows for a set of posts and returns { [itemId]: [{...row, url}] }. */
export async function loadImagesForItems(itemIds) {
  if (!itemIds.length) return {}
  const { data: rows, error } = await supabase
    .from('campaign_item_images')
    .select('*')
    .in('item_id', itemIds)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return groupWithUrls(rows)
}

export async function groupWithUrls(rows) {
  const byItem = {}
  if (!rows.length) return byItem
  const { data: signed, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_SECONDS,
    )
  if (error) throw error
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]))
  for (const row of rows) {
    ;(byItem[row.item_id] ??= []).push({ ...row, url: urlByPath.get(row.storage_path) ?? null })
  }
  return byItem
}

/** Removes files from the images bucket. Failures are logged, not thrown: the rows are already gone. */
export async function removeImageFiles(paths) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
  if (error) console.error('Could not remove image files', error)
}

/** Deletes a campaign, its posts and image rows (cascade), then its image files. */
export async function deleteCampaign(campaignId) {
  const { data: imgs, error: imgError } = await supabase
    .from('campaign_item_images')
    .select('storage_path, campaign_items!inner(campaign_id)')
    .eq('campaign_items.campaign_id', campaignId)
  if (imgError) throw imgError
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId)
  if (error) throw error
  await removeImageFiles(imgs.map((i) => i.storage_path))
}

/** Deletes a post and its image rows (cascade), then its image files. */
export async function deleteItem(itemId) {
  const { data: imgs, error: imgError } = await supabase
    .from('campaign_item_images')
    .select('storage_path')
    .eq('item_id', itemId)
  if (imgError) throw imgError
  const { error } = await supabase.from('campaign_items').delete().eq('id', itemId)
  if (error) throw error
  await removeImageFiles(imgs.map((i) => i.storage_path))
}

export async function downloadFile(url, filename) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

export const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'image'
