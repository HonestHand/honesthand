import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Elite waitlist capture.
 * Stores entries in the existing `contact_messages` table with
 * category = 'elite_waitlist' so no new table migration is required.
 */
export async function POST(request: NextRequest) {
  const { name, email, businessName } = await request.json()

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase.from('contact_messages').insert({
    name:     name?.trim()         || '',
    email:    email.trim().toLowerCase(),
    category: 'elite_waitlist',
    message:  businessName?.trim()
      ? `Elite waitlist — Business: ${businessName.trim()}`
      : 'Elite waitlist signup.',
    user_id:  null,
  })

  if (error) {
    console.error('[elite-waitlist] insert error:', error)
    return NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
