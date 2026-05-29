import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/emailSender'
import { midMonthInsightEmail } from '../../../lib/emailTemplates'

export const maxDuration = 60

/**
 * Mid-month engagement email cron.
 * Runs on the 15th of each month (see vercel.json).
 * Sends a useful, non-spammy check-in to active Pro subscribers.
 * Deduplicated via emailSender (28-day cooldown = once per month max).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, business_name, email_midmonth_insights')
    .eq('is_pro', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = { sent: 0, skipped: 0, failed: 0 }
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  for (const profile of profiles ?? []) {
    // Respect email preference (default true if column missing)
    if (profile.email_midmonth_insights === false) {
      results.skipped++
      continue
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id)
      const toEmail = authUser?.email
      if (!toEmail) { results.skipped++; continue }

      const bizName  = profile.business_name || 'Your business'
      const template = midMonthInsightEmail({ businessName: bizName, monthYear })

      const result = await sendEmail({
        userId:  profile.id,
        to:      toEmail,
        type:    'midmonth_insight',
        subject: template.subject,
        html:    template.html,
      })

      if (result.sent) {
        results.sent++
      } else {
        results.skipped++
        console.log('[mid-month] skipped', profile.id, ':', result.reason)
      }
    } catch (err) {
      results.failed++
      console.error('[mid-month] error for', profile.id, err)
    }
  }

  return NextResponse.json({ total: (profiles ?? []).length, ...results })
}
