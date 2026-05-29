import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/emailSender'
import { abandonedPaywallEmail } from '../../../lib/emailTemplates'

/**
 * Abandoned paywall follow-up email.
 *
 * Called from the dashboard client when the upgrade wall has been visible for
 * several seconds and the user has not converted.
 *
 * Rules:
 * - Only fires for non-Pro users
 * - 7-day cooldown enforced by emailSender dedup
 * - No discounts, no fake urgency — honest reminder only
 */
export async function POST(request: NextRequest) {
  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch user profile + auth email
  const [
    { data: profile },
    { data: { user: authUser } },
  ] = await Promise.all([
    supabase.from('profiles').select('business_name, is_pro').eq('id', userId).single(),
    supabase.auth.admin.getUserById(userId),
  ])

  // Don't send if the user has since subscribed
  if (profile?.is_pro === true || profile?.is_pro === 'true') {
    return NextResponse.json({ ok: true, sent: false, reason: 'User is already Pro' })
  }

  const email = authUser?.email
  if (!email) {
    return NextResponse.json({ error: 'Could not resolve user email' }, { status: 400 })
  }

  const businessName = profile?.business_name || 'Your business'
  const template = abandonedPaywallEmail({ businessName })

  const result = await sendEmail({
    userId,
    to:      email,
    type:    'abandoned_paywall',
    subject: template.subject,
    html:    template.html,
  })

  return NextResponse.json({ ok: true, sent: result.sent, reason: result.reason })
}
