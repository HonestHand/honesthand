import { createClient } from '@supabase/supabase-js'

export const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) return null
  
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = typeof window !== 'undefined' 
  ? getSupabase()
  : null