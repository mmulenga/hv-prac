import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Returns null when env vars aren't configured so the app still works
// for guests without a Supabase project set up.
export const supabase = url && key ? createClient(url, key) : null
