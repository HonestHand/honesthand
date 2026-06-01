import { Resend } from 'resend'

// ─── Error codes ──────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'PROVIDER_BILLING'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_AUTH'
  | 'PROVIDER_OVERLOAD'
  | 'REPORT_IN_PROGRESS'
  | 'TOO_RECENT'
  | 'UNKNOWN'

export interface SanitizedError {
  code: ErrorCode
  /** Safe to show to users — never contains provider names, billing info, or stack traces */
  userMessage: string
  /** Whether to send an admin alert (billing, auth failures) */
  shouldAlert: boolean
  /** Whether the error is worth retrying (rate limits, timeouts, overload) */
  retryable: boolean
  /** Raw message for internal logging only — never sent to client */
  rawMessage: string
}

// ─── Pattern → classification map ────────────────────────────────────────────
// Ordered most-specific first. rawMessage is captured but never sent to the client.

const ERROR_PATTERNS: Array<Omit<SanitizedError, 'rawMessage'> & { pattern: RegExp }> = [
  {
    pattern: /credit balance is too low|insufficient.*credit|billing|payment required|quota.?exceeded|overdue|past.?due/i,
    code:         'PROVIDER_BILLING',
    userMessage:  "We're having a brief service interruption. Your most recent report is shown below.",
    shouldAlert:  true,
    retryable:    false,
  },
  {
    pattern: /invalid.*api.*key|authentication.?error|auth.*failed|Unauthorized|401|403/i,
    code:         'PROVIDER_AUTH',
    userMessage:  "We're having a brief service interruption. Your most recent report is shown below.",
    shouldAlert:  true,
    retryable:    false,
  },
  {
    pattern: /rate.?limit|too many requests|429|Request too large/i,
    code:         'PROVIDER_RATE_LIMIT',
    userMessage:  "We're verifying current program data. This may take a little longer than usual.",
    shouldAlert:  false,
    retryable:    true,
  },
  {
    pattern: /timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT|deadline|AbortError/i,
    code:         'PROVIDER_TIMEOUT',
    userMessage:  "Report generation is taking longer than expected. Please try again in a moment.",
    shouldAlert:  false,
    retryable:    true,
  },
  {
    pattern: /overloaded|server.?error|503|502|500|ECONNRESET|ECONNREFUSED/i,
    code:         'PROVIDER_OVERLOAD',
    userMessage:  "Our report service is temporarily busy. Please try again in a few minutes.",
    shouldAlert:  false,
    retryable:    true,
  },
]

export function classifyError(error: unknown): SanitizedError {
  const rawMessage = error instanceof Error ? error.message : String(error)
  for (const entry of ERROR_PATTERNS) {
    if (entry.pattern.test(rawMessage)) {
      return { code: entry.code, userMessage: entry.userMessage, shouldAlert: entry.shouldAlert, retryable: entry.retryable, rawMessage }
    }
  }
  return {
    code:        'UNKNOWN',
    userMessage: "We're having trouble preparing your report right now. Your previous report is shown below.",
    shouldAlert: false,
    retryable:   false,
    rawMessage,
  }
}

// ─── Safe user message for special flow codes ─────────────────────────────────

export const FLOW_MESSAGES: Record<string, string> = {
  REPORT_IN_PROGRESS: "Your report is already being refreshed. Check back in a few minutes.",
  TOO_RECENT:         "Your report was recently updated. Showing your current report.",
}

// ─── Admin alert ──────────────────────────────────────────────────────────────

export async function sendAdminAlert(opts: {
  code: ErrorCode
  rawError: string
  userId?: string
  businessName?: string
  attemptCount?: number
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    // No Resend key — log to console so it shows in Vercel logs
    console.error('[ADMIN ALERT] Report failure:', JSON.stringify({
      code:         opts.code,
      userId:       opts.userId,
      businessName: opts.businessName,
      attemptCount: opts.attemptCount,
      rawError:     opts.rawError.slice(0, 300),
      time:         new Date().toISOString(),
    }))
    return
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    'HonestHand Alerts <onboarding@resend.dev>',
      to:      'honesthand.tx@gmail.com',
      subject: `[HonestHand ALERT] ${opts.code} — report generation failure`,
      html: `
        <div style="font-family:system-ui;max-width:560px;padding:24px">
          <h2 style="color:#DC2626;margin:0 0 16px">⚠️ Report Generation Failure</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600;width:140px">Error Code</td>
                <td style="padding:8px 12px;border:1px solid #E5E7EB"><strong style="color:#DC2626">${opts.code}</strong></td></tr>
            <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600">User ID</td>
                <td style="padding:8px 12px;border:1px solid #E5E7EB;font-family:monospace">${opts.userId ?? 'unknown'}</td></tr>
            <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600">Business</td>
                <td style="padding:8px 12px;border:1px solid #E5E7EB">${opts.businessName ?? 'unknown'}</td></tr>
            <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600">Attempts</td>
                <td style="padding:8px 12px;border:1px solid #E5E7EB">${opts.attemptCount ?? 1}</td></tr>
            <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600">Raw Error</td>
                <td style="padding:8px 12px;border:1px solid #E5E7EB;font-family:monospace;font-size:11px;color:#DC2626;word-break:break-all">${opts.rawError.slice(0, 500)}</td></tr>
            <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600">Time (UTC)</td>
                <td style="padding:8px 12px;border:1px solid #E5E7EB">${new Date().toISOString()}</td></tr>
          </table>
          <p style="margin-top:16px;font-size:12px;color:#6B7280">
            ⚠️ Customers are NOT seeing this error. They see a safe status message.
          </p>
        </div>
      `,
    })
  } catch (alertErr) {
    // Alert failure must never propagate — log and continue
    console.error('[admin-alert] Failed to send alert:', alertErr)
  }
}
