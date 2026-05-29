import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../lib/emailSender'
import { freeReportReadyEmail, proReportReadyEmail } from '../../lib/emailTemplates'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let userId: string
  let content: string

  try {
    const body = await request.json()
    userId  = body.userId
    content = body.content
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!userId || !content) {
    return NextResponse.json({ error: 'Missing userId or content' }, { status: 400 })
  }

  const generatedAt = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('reports')
    .upsert(
      { user_id: userId, content, generated_at: generatedAt },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[save-report] upsert error:', error)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }

  // ── Report-ready email (non-fatal) ───────────────────────────────────────
  // Use a report-specific ID so the email is sent exactly once per generated report.
  const reportId = `${userId}-${generatedAt.slice(0, 10)}`   // once per user-day

  void (async () => {
    try {
      const [
        { data: profile },
        { data: { user: authUser } },
      ] = await Promise.all([
        supabaseAdmin.from('profiles').select('business_name, is_pro, email_monthly_reports').eq('id', userId).single(),
        supabaseAdmin.auth.admin.getUserById(userId),
      ])

      const email = authUser?.email
      if (!email) return

      const businessName = profile?.business_name || 'Your business'
      const isPro        = profile?.is_pro === true || profile?.is_pro === 'true'

      // Check user's email preference (email_monthly_reports covers both report types)
      const prefOk = profile?.email_monthly_reports !== false

      if (!prefOk) return

      const template = isPro
        ? proReportReadyEmail({ businessName })
        : freeReportReadyEmail({ businessName })

      const result = await sendEmail({
        userId,
        to:       email,
        type:     isPro ? 'report_ready_pro' : 'report_ready_free',
        subject:  template.subject,
        html:     template.html,
        reportId,
      })

      if (!result.sent) {
        console.log('[save-report] email not sent:', result.reason)
      }
    } catch (err) {
      console.error('[save-report] email error (non-fatal):', err)
    }
  })()

  return NextResponse.json({ ok: true })
}
