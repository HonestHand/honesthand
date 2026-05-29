/**
 * ─── Test email endpoint ──────────────────────────────────────────────────────
 *
 * Sends a real email through the full production pipeline (Resend + email_logs)
 * so you can verify the system end-to-end without triggering a signup or report.
 *
 * PROTECTED: requires the CRON_SECRET header to prevent public abuse.
 *
 * Usage (from terminal):
 *   curl -X POST https://yourhonesthand.com/api/test-email \
 *     -H "Authorization: Bearer <CRON_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"to":"you@example.com","type":"welcome"}'
 *
 * Or from VS Code terminal (PowerShell):
 *   $secret = "your-cron-secret"
 *   Invoke-RestMethod -Method POST -Uri "https://yourhonesthand.com/api/test-email" `
 *     -Headers @{ Authorization = "Bearer $secret"; "Content-Type" = "application/json" } `
 *     -Body '{"to":"you@example.com","type":"welcome"}'
 */

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  // ── Auth check ─────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      ok:    false,
      error: 'RESEND_API_KEY is not set in production environment variables.',
    }, { status: 500 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let to:   string
  let type: string
  try {
    const body = await request.json()
    to   = body.to?.trim()
    type = body.type || 'welcome'
    if (!to) throw new Error('missing to')
  } catch {
    return NextResponse.json({ error: 'Body must be JSON with a "to" email address.' }, { status: 400 })
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'HonestHand <onboarding@resend.dev>'
  const timestamp   = new Date().toISOString()

  // ── Send test email directly via Resend (bypasses dedup) ───────────────────
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from:    fromAddress,
    to,
    subject: `[HonestHand Test] Email pipeline check — ${timestamp}`,
    html: `
      <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;">
        <div style="font-size:20px;font-weight:700;color:#2C2C2A;margin-bottom:8px;">
          Honest<span style="color:#1D9E75;">Hand</span> — Email Test
        </div>
        <p style="color:#4B5563;font-size:14px;line-height:1.7;">
          This is a production pipeline test email. If you received this, Resend is
          correctly configured and your <code>RESEND_API_KEY</code> is working.
        </p>
        <table style="margin-top:16px;border-collapse:collapse;width:100%;font-size:13px;">
          <tr>
            <td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600;color:#6B7280;width:40%;">Sent at</td>
            <td style="padding:8px 12px;border:1px solid #E5E7EB;color:#2C2C2A;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600;color:#6B7280;">From</td>
            <td style="padding:8px 12px;border:1px solid #E5E7EB;color:#2C2C2A;">${fromAddress}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600;color:#6B7280;">To</td>
            <td style="padding:8px 12px;border:1px solid #E5E7EB;color:#2C2C2A;">${to}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600;color:#6B7280;">Type</td>
            <td style="padding:8px 12px;border:1px solid #E5E7EB;color:#2C2C2A;">${type}</td>
          </tr>
        </table>
        <p style="margin-top:16px;font-size:12px;color:#9CA3AF;">
          This email was sent via the /api/test-email endpoint. It does not affect any user data.
        </p>
      </div>
    `,
  })

  if (error) {
    console.error(`[test-email] ${timestamp} | to=${to} | from=${fromAddress} | FAILED: ${error.message}`)
    return NextResponse.json({
      ok:        false,
      timestamp,
      to,
      from:      fromAddress,
      resendError: error,
      diagnosis: diagnose(error.message),
    }, { status: 500 })
  }

  console.log(`[test-email] ${timestamp} | to=${to} | from=${fromAddress} | SENT | messageId=${data?.id}`)
  return NextResponse.json({
    ok:        true,
    timestamp,
    to,
    from:      fromAddress,
    messageId: data?.id,
    message:   'Test email sent. Check the recipient inbox (and spam folder). Look up the messageId in your Resend dashboard.',
  })
}

// ─── Diagnose common Resend errors ────────────────────────────────────────────

function diagnose(errorMessage: string): string {
  const m = errorMessage.toLowerCase()
  if (m.includes('api key') || m.includes('unauthorized') || m.includes('403')) {
    return 'RESEND_API_KEY may be invalid, expired, or have whitespace. Re-add it via: npx vercel env rm RESEND_API_KEY production --yes && npx vercel env add RESEND_API_KEY production'
  }
  if (m.includes('from') || m.includes('domain') || m.includes('sender') || m.includes('not allowed')) {
    return 'The FROM address is not verified in your Resend account. Add a verified domain at resend.com/domains, then set RESEND_FROM_EMAIL=noreply@yourdomain.com in Vercel.'
  }
  if (m.includes('rate') || m.includes('limit')) {
    return 'Resend rate limit hit. Wait a moment and retry.'
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'The recipient email address is malformed.'
  }
  return 'Check the Resend dashboard → Logs for more detail on this error.'
}
