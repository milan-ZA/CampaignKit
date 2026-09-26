import { createClient } from 'npm:@supabase/supabase-js@2'
import { getUserClient, HttpError, json, readJson, serve, str } from '../_shared/http.ts'

const BUCKET = 'post-images'
const CONFIRM_WORD = 'DELETE'

/**
 * Permanently deletes the caller's account.
 * 1. Removes every file in their own storage folder ({user_id}/…), acting as the user so the
 *    storage rules still apply.
 * 2. Deletes the login with the admin (service role) client. The database then removes their
 *    brand profile, campaigns, posts and image rows automatically (ON DELETE CASCADE).
 * The service role key is only used for that one call, and only on the caller's own user id.
 */
serve(async (req) => {
  const { supabase, user } = await getUserClient(req)
  const body = await readJson(req)
  if (str(body.confirm) !== CONFIRM_WORD) {
    throw new HttpError(400, `Please type ${CONFIRM_WORD} to confirm.`)
  }

  // ---- 1. Files: everything under {user_id}/ (post images in {item_id}/ folders, logo in brand/) ----
  const paths: string[] = []
  const { data: folders, error: listError } = await supabase.storage.from(BUCKET).list(user.id, { limit: 1000 })
  if (listError) {
    console.error(listError)
    throw new HttpError(500, "We couldn't reach your files. Nothing was deleted. Please try again.")
  }
  for (const entry of folders ?? []) {
    if (entry.id) {
      paths.push(`${user.id}/${entry.name}`) // a file directly in the user's folder
      continue
    }
    const { data: files, error } = await supabase.storage.from(BUCKET).list(`${user.id}/${entry.name}`, { limit: 1000 })
    if (error) {
      console.error(error)
      throw new HttpError(500, "We couldn't reach your files. Nothing was deleted. Please try again.")
    }
    for (const f of files ?? []) if (f.id) paths.push(`${user.id}/${entry.name}/${f.name}`)
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100))
    if (error) {
      console.error(error)
      throw new HttpError(500, "We couldn't delete all your files. Your account is still there. Please try again.")
    }
  }

  // ---- 2. The login itself (cascades to all of the user's rows) ----
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
    throw new HttpError(500, "Account deletion isn't available right now. Please try again later.")
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error(deleteError)
    throw new HttpError(
      500,
      "Your files were removed, but we couldn't delete your account. Please try again.",
    )
  }

  return json({ deleted: true, files_removed: paths.length })
})
