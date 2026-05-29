import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  let body: { event?: string; properties?: unknown; userId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ ok: true }) }

  const { event, properties, userId } = body
  if (!event) return NextResponse.json({ ok: true })

  // Log to console always (useful in Vercel logs)
  console.log('[analytics]', event, userId ?? 'anon', JSON.stringify(properties ?? {}))

  // Persist to Supabase if table exists (silently skip if not)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await supabase.from('analytics_events').insert({
      user_id:    userId  ?? null,
      event_name: event,
      properties: properties ?? null,
    })
  } catch {
    // Table may not exist yet — non-fatal
  }

  return NextResponse.json({ ok: true })
}
