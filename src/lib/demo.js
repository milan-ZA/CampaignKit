import { useState } from 'react'
import { useBrand } from '../context/BrandContext'
import { useConfirm } from '../context/ConfirmContext'
import { deleteCampaign, removeImageFiles } from './api'
import { supabase } from './supabase'

/** The Sunrise Bakery example used by "Use demo profile". Its keys are also the brand profile form fields. */
export const DEMO_PROFILE = {
  owner_name: 'Thandi Mokoena',
  owner_story: 'I grew up baking with my gran and wanted a place where neighbours meet over good bread.',
  owner_values: 'Fresh ingredients, local suppliers, no shortcuts.',
  owner_personality: 'Warm, chatty, always remembers your order.',
  owner_expertise: 'Slow-proved sourdough and hearty winter soups.',
  business_name: 'Sunrise Bakery',
  what_you_sell: 'Artisan bread, pastries, soups and coffee',
  location: 'Parkhurst, Johannesburg',
  customers: 'Office workers and young families nearby',
  what_makes_you_different: 'Everything baked on site before 6am',
  price_level: 'Mid-range',
  website: null,
  preferred_language: 'English',
  tone_words: ['Warm', 'Friendly', 'Down-to-earth'],
  words_to_use: 'fresh, from our oven, neighbours',
  words_to_avoid: 'cheap, deal of the century',
  emoji_use: 'A few',
  example_post: null,
  visual_style: 'Photo',
  brand_colours: 'warm orange, cream and dark brown',
  channels: ['Instagram', 'Facebook', 'WhatsApp', 'Google Business Profile'],
}

export const PROFILE_FIELDS = Object.keys(DEMO_PROFILE)

const hasValue = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v != null)

/** True when the user has a brand profile row with at least one field filled in. */
export const profileHasData = (profile) => !!profile && PROFILE_FIELDS.some((k) => hasValue(profile[k]))

/**
 * Removes the demo. Safe to run again after a failure: it looks campaigns up by their snapshot,
 * not by the profile, so pressing "Remove demo" again finishes whatever is left.
 * 1. Deletes campaigns made with the demo (brand_snapshot.is_demo = true), including their image files.
 * 2. Clears every brand profile field, the logo and the demo flag.
 * Row Level Security limits every step to the signed-in user's own rows and files.
 * Returns the cleared profile row.
 */
async function removeDemoData(userId, logoPath) {
  const { data: demoCampaigns, error: findError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('brand_snapshot->>is_demo', 'true')
  if (findError) throw findError
  for (const c of demoCampaigns) await deleteCampaign(c.id)

  const cleared = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, Array.isArray(DEMO_PROFILE[k]) ? [] : null]))
  const { data: profile, error: clearError } = await supabase
    .from('brand_profiles')
    .update({ ...cleared, logo_path: null, is_demo: false })
    .eq('user_id', userId)
    .select()
    .single()
  if (clearError) throw clearError

  if (logoPath) await removeImageFiles([logoPath])
  return profile
}

/** Confirmation + removal, shared by the Brand profile page and the Campaigns screen. */
export function useRemoveDemo() {
  const { profile, setProfile } = useBrand()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  /** Resolves to true when the demo was removed. */
  const removeDemo = async ({ skipConfirm = false } = {}) => {
    if (busy || !profile) return false
    if (
      !skipConfirm &&
      !(await confirm({
        title: 'Remove the demo data?',
        message:
          "This clears the Sunrise Bakery brand profile and deletes the campaigns you made with it, including posts, scripts, briefs and images. You can't undo this.",
        confirmLabel: 'Remove demo',
        danger: true,
      }))
    ) {
      return false
    }
    setBusy(true)
    setError(null)
    try {
      setProfile(await removeDemoData(profile.user_id, profile.logo_path))
      return true
    } catch (err) {
      console.error(err)
      setError("We couldn't remove all the demo data. Please try again.")
      return false
    } finally {
      setBusy(false)
    }
  }

  return { removeDemo, busy, error }
}
