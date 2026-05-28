import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let userId: string
  let content: string

  try {
    const body = await request.json()
    userId = body.userId
    content = body.content
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!userId || !content) {
    return NextResponse.json({ error: 'Missing userId or content' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('reports')
    .upsert(
      { user_id: userId, content, generated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[save-report] upsert error:', error)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
