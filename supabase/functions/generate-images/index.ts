import { IMAGE_SIZES } from '../_shared/brand.ts'
import { getUserClient, HttpError, json, readJson, serve, str } from '../_shared/http.ts'
import { generateImages } from '../_shared/openai.ts'

const BUCKET = 'post-images'
const IMAGE_COUNT = 3

const STYLE_HINTS: Record<string, string> = {
  Photo: 'a natural, realistic photograph with soft natural light',
  Illustration: 'a friendly, hand-drawn style illustration',
  'Simple graphic': 'a clean, simple flat graphic with bold shapes',
}

serve(async (req) => {
  const { supabase, user } = await getUserClient(req)
  const body = await readJson(req)
  const itemId = str(body.item_id)
  if (!itemId) throw new HttpError(400, 'Please choose a post.')

  const { data: item, error: itemError } = await supabase
    .from('campaign_items')
    .select('*, campaign:campaigns(*)')
    .eq('id', itemId)
    .maybeSingle()
  if (itemError) console.error(itemError)
  if (!item || item.campaign?.user_id !== user.id) throw new HttpError(404, "We couldn't find that post.")

  const { data: profile } = await supabase.from('brand_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (!profile) throw new HttpError(400, 'Please set up your brand profile first.')

  // ---- Prompt ----------------------------------------------------------------
  const { size, format } = IMAGE_SIZES[item.channel] ?? IMAGE_SIZES.Instagram
  const scene = item.creative_brief?.trim()
    ? `Follow this creative brief:\n${item.creative_brief.trim().slice(0, 2000)}`
    : `The post is about: ${item.content_idea}\nPost text (for context only, do not write it in the image): ${String(item.copy ?? '').slice(0, 800)}`

  const prompt = [
    `Create ${STYLE_HINTS[profile.visual_style] ?? STYLE_HINTS.Photo} for a small business.`,
    `Business: ${profile.business_name ?? 'a local business'}${profile.what_you_sell ? `, which sells ${profile.what_you_sell}` : ''}${profile.location ? `, based in ${profile.location}` : ''}.`,
    Array.isArray(profile.tone_words) && profile.tone_words.length ? `The mood should feel ${profile.tone_words.join(', ')}.` : '',
    scene,
    profile.brand_colours ? `Use these brand colours as the main colour palette: ${profile.brand_colours}.` : '',
    `Format: ${format}. Compose the picture so it works well in this shape.`,
    'IMPORTANT: Do not put any words, letters, numbers, text, signs with writing, labels or logos anywhere in the image. The text goes in the caption.',
  ]
    .filter(Boolean)
    .join('\n')

  // ---- Generate ----------------------------------------------------------------
  const pictures = await generateImages(prompt, size, IMAGE_COUNT)

  // ---- Upload new files; roll back this run on any failure -------------------
  const newRows: { id: string; storage_path: string; prompt: string; size: string }[] = []
  const rollback = async () => {
    if (newRows.length) await supabase.storage.from(BUCKET).remove(newRows.map((r) => r.storage_path))
  }

  try {
    for (const bytes of pictures) {
      const id = crypto.randomUUID()
      const storage_path = `${user.id}/${item.id}/${id}.png`
      const { error } = await supabase.storage.from(BUCKET).upload(storage_path, bytes, {
        contentType: 'image/png',
        upsert: false,
      })
      if (error) throw error
      newRows.push({ id, storage_path, prompt, size })
    }
  } catch (err) {
    console.error('Upload failed', err)
    await rollback()
    throw new HttpError(500, "We couldn't save your images. Please try again.")
  }

  // Swap old rows for new rows in one transaction; returns the old file paths.
  const { data: oldPaths, error: swapError } = await supabase.rpc('replace_item_images', {
    p_item_id: item.id,
    p_images: newRows,
  })
  if (swapError) {
    console.error('Insert failed', swapError)
    await rollback()
    throw new HttpError(500, "We couldn't save your images. Please try again.")
  }

  // New images are saved, so it's now safe to remove the old files.
  const toRemove = (Array.isArray(oldPaths) ? oldPaths : []).filter((p): p is string => typeof p === 'string')
  if (toRemove.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(toRemove)
    if (error) console.error('Could not remove old image files', error)
  }

  // ---- Respond with the saved rows and signed URLs ----------------------------
  const { data: rows, error: rowsError } = await supabase
    .from('campaign_item_images')
    .select('*')
    .eq('item_id', item.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (rowsError) throw new HttpError(500, 'Your images were saved but could not be loaded. Please refresh the page.')

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60)
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))

  return json({ images: rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) ?? null })) })
})
