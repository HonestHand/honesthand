import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Use the anon client for resend — this is a user-facing auth action
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.auth.resend({
    type:  'signup',
    email: normalizedEmail,
    options: {
      emailRedirectTo:
        `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourhonesthand.com'}/auth/confirm`,
    },
  })

  if (error) {
    console.error('[resend-verification]', error.message)
    return NextResponse.json(
      { error: 'Could not resend verification email. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
