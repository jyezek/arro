import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

// Client for public/browser-safe operations (uses publishable key)
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Admin client for server-side only — bypasses RLS (uses secret key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
})
