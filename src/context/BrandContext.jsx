import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const BrandContext = createContext(null)

/** Loads the signed-in user's brand profile once and shares it across screens. */
export function BrandProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.from('brand_profiles').select('*').eq('user_id', user.id).maybeSingle()
    if (err) setError("We couldn't load your brand profile.")
    else setProfile(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const ready = !!profile && Array.isArray(profile.channels) && profile.channels.length > 0

  return (
    <BrandContext.Provider value={{ profile, setProfile, loading, error, reload, ready }}>
      {children}
    </BrandContext.Provider>
  )
}

export const useBrand = () => useContext(BrandContext)
