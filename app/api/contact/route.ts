import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const CATEGORY_LABELS: Record<string, string> = {
  bug:     'Something is broken',
  billing: 'Billing or subscription',
  report:  'Question about my report',
  other:   'Something else',
}

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

  // Send notification email if Resend is configured
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const result = await resend.emails.send({
        from: 'HonestHand <support@yourhonesthand.com>',
        to: 'honesthand.tx@gmail.com',
        subject: `New message: ${CATEGORY_LABELS[category] || category}`,
        html: `
          <div style="font-family:system-ui;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#1D9E75;margin:0 0 16px">New HonestHand Contact Message</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600;width:120px">From</td><td style="padding:8px 12px;border:1px solid #E5E7EB">${name || 'Not provided'}</td></tr>
              <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600">Email</td><td style="padding:8px 12px;border:1px solid #E5E7EB"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600">Category</td><td style="padding:8px 12px;border:1px solid #E5E7EB">${CATEGORY_LABELS[category] || category}</td></tr>
            </table>
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.6">${message.trim()}</div>
            <p style="margin-top:20px;font-size:13px;color:#6B7280">Reply directly to <a href="mailto:${email}">${email}</a> to respond.</p>
          </div>
        `,
      })
      console.log('[contact] resend result:', JSON.stringify(result))
    } catch (e) {
      console.error('[contact] resend error:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
