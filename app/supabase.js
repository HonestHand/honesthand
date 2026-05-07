'use client'
import { createClient } from '@supabase/supabase-js'

let supabaseInstance = null

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key || url === 'undefined' || key === 'undefined') {
    return null
  }
  
  supabaseInstance = createClient(url, key)
  return supabaseInstance
}

export const supabase = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null
    return createClient(url, key)
  } catch {
    return null
  }
})()