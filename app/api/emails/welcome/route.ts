import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '../../../lib/emailSender'
import { welcomeEmail } from '../../../lib/emailTemplates'

export async function POST(request: NextRequest) {
  const { userId, email } = await request.json()
  if (!userId || !email) {
    return NextResponse.json({ error: 'userId and email are required' }, { status: 400 })
  }

  const template = welcomeEmail({ email })

  const result = await sendEmail({
    userId,
    to:      email,
    type:    'welcome',
    subject: template.subject,
    html:    template.html,
  })

  if (!result.sent) {
    console.log('[emails/welcome] not sent:', result.reason)
  }

  // Always return 200 — callers treat this as fire-and-forget
  return NextResponse.json({ ok: true, sent: result.sent, reason: result.reason })
}
