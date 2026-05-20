import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { name, email, category, message, userId } = await request.json()

  if (!email?.trim() || !message?.trim() || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase.from('contact_messages').insert({
    name: name?.trim() || '',
    email: email.trim(),
    category,
    message: message.trim(),
    user_id: userId || null,
  })

  if (error) {
    console.error('[contact] insert error:', error)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
