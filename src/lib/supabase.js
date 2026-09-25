import { createClient } from '@supabase/supabase-js'

// Public defaults for the course MVP's shared Supabase project, so any copy of the repo
// (Bolt, a teammate's computer) works without a .env file. Both values are public by design:
// the anon key ships inside the website anyway, and Row Level Security protects the data.
// A .env / host environment variable still overrides them.
const DEFAULT_URL = 'https://qofkowtsscwsqzpxnjeq.supabase.co'
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvZmtvd3Rzc2N3c3F6cHhuamVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzY4MDYsImV4cCI6MjEwNTkxMjgwNn0.DP1FiuTA5g2DgPbuqwZLpC91Kyq6GKhFA9HA3FHE4lk'

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null

export const IMAGE_BUCKET = 'post-images'
