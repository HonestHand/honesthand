/**
 * ─── Email sender with deduplication ─────────────────────────────────────────
 *
 * All outbound emails flow through this module.
 * Before sending, it checks `email_logs` (if available) to prevent duplicate
 * sends within the configured cooldown window.
 *
 * REQUIRED ENV VARS:
 *   RESEND_API_KEY       — Resend secret key (server-only, never NEXT_PUBLIC_)
 *   RESEND_FROM_EMAIL    — Verified sender address, e.g. "HonestHand <hello@yourhonesthand.com>"
 *                          Falls back to shared sandbox "onboarding@resend.dev" if not set,
 *                          but the shared domain has poor deliverability — set this in production.
 *
 * REQUIRED SQL MIGRATIONS (run once in Supabase Dashboard → SQL Editor):
 *
 *   CREATE TABLE IF NOT EXISTS email_logs (
 *     id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id             uuid        NOT NULL,
 *     email_type          text        NOT NULL,
 *     report_id           text,
 *     recipient_email     text,
 *     status              text        DEFAULT 'sent',
 *     provider_message_id text,
 *     error_message       text,
 *     sent_at             timestamptz DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS email_logs_user_type ON email_logs(user_id, email_type);
 *   CREATE INDEX IF NOT EXISTS email_logs_sent_at   ON email_logs(sent_at);
 *
 * If you already ran the earlier migration, add the new columns:
 *   ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient_email     text;
 *   ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider_message_id text;
 *   ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error_message       text;
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ─── Email type registry ──────────────────────────────────────────────────────

export type EmailType =
  | 'welcome'           // once per user (on email confirmation)
  | 'report_ready_free' // once per reportId
  | 'report_ready_pro'  // once per reportId
  | 'pro_confirmed'     // once per user (on Pro activation)
  | 'monthly_report'    // 20-day cooldown (monthly cycle)
  | 'midmonth_insight'  // 28-day cooldown (once per month)
  | 'abandoned_paywall' // 7-day cooldown

/** Days to wait before resending the same email type. */
const COOLDOWN_DAYS: Partial<Record<EmailType, number>> = {
  monthly_report:    20,
  midmonth_insight:  28,
  abandoned_paywall:  7,
}

/** Email types that should be sent exactly once per user, ever. */
const SEND_ONCE: EmailType[] = ['welcome', 'pro_confirmed']

// ─── Options ─────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  /** Supabase user ID — used for dedup tracking. */
  userId:    string
  /** Recipient address. */
  to:        string
  /** Email category for dedup. */
  type:      EmailType
  subject:   string
  html:      string
  /** Optional report identifier for per-report dedup. */
  reportId?: string
}

export interface SendResult {
  sent:       boolean
  reason?:    string
  messageId?: string
}

// ─── Core send function ───────────────────────────────────────────────────────

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const { userId, to, type, subject, html, reportId } = opts
  const timestamp = new Date().toISOString()

  // ── Guard: API key must be present ──────────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    console.error(`[emailSender] ${timestamp} | type=${type} | to=${to} | FAILED: RESEND_API_KEY not set`)
    return { sent: false, reason: 'RESEND_API_KEY not set' }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── Deduplication check ──────────────────────────────────────────────────
  try {
    if (SEND_ONCE.includes(type)) {
      const { data } = await supabase
        .from('email_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', type)
        .eq('status', 'sent')
        .limit(1)
      if (data && data.length > 0) {
        console.log(`[emailSender] ${timestamp} | type=${type} | to=${to} | SKIPPED: already sent (send-once)`)
        return { sent: false, reason: `${type} already sent to this user` }
      }
    } else if ((type === 'report_ready_free' || type === 'report_ready_pro') && reportId) {
      const { data } = await supabase
        .from('email_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', type)
        .eq('report_id', reportId)
        .eq('status', 'sent')
        .limit(1)
      if (data && data.length > 0) {
        console.log(`[emailSender] ${timestamp} | type=${type} | to=${to} | reportId=${reportId} | SKIPPED: already sent for this report`)
        return { sent: false, reason: 'report-ready email already sent for this report' }
      }
    } else if (COOLDOWN_DAYS[type]) {
      const cutoff = new Date(
        Date.now() - (COOLDOWN_DAYS[type]! * 24 * 60 * 60 * 1000)
      ).toISOString()
      const { data } = await supabase
        .from('email_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', type)
        .eq('status', 'sent')
        .gte('sent_at', cutoff)
        .limit(1)
      if (data && data.length > 0) {
        console.log(`[emailSender] ${timestamp} | type=${type} | to=${to} | SKIPPED: within ${COOLDOWN_DAYS[type]}-day cooldown`)
        return { sent: false, reason: `${type} sent within cooldown window` }
      }
    }
  } catch (err) {
    // email_logs table may not exist yet → fail open (send anyway, skip dedup)
    console.warn(`[emailSender] ${timestamp} | type=${type} | to=${to} | dedup check failed (table may not exist) — sending anyway:`, err)
  }

  // ── Resolve FROM address ─────────────────────────────────────────────────
  // Set RESEND_FROM_EMAIL in Vercel to a verified sender, e.g.:
  //   HonestHand <hello@yourhonesthand.com>
  // Without a verified domain, deliverability will be poor in production.
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'HonestHand <onboarding@resend.dev>'

  // ── Send via Resend ──────────────────────────────────────────────────────
  let messageId: string | undefined
  let sendError: string | undefined

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    // IMPORTANT: resend.emails.send() returns { data, error } — it does NOT throw.
    // Always check the error field; never assume success from a non-throw.
    const { data, error: resendError } = await resend.emails.send({
      from:    fromAddress,
      to,
      replyTo: 'honesthand.tx@gmail.com',
      subject,
      html,
    })

    if (resendError) {
      sendError = resendError.message || JSON.stringify(resendError)
      console.error(`[emailSender] ${timestamp} | type=${type} | to=${to} | from=${fromAddress} | RESEND API ERROR: ${sendError}`)
      // Log the failure before returning
      await logEmail({ supabase, userId, to, type, reportId, status: 'failed', errorMessage: sendError })
      return { sent: false, reason: `Resend error: ${sendError}` }
    }

    messageId = data?.id
    console.log(`[emailSender] ${timestamp} | type=${type} | to=${to} | from=${fromAddress} | SENT | messageId=${messageId ?? 'unknown'}`)

  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
    console.error(`[emailSender] ${timestamp} | type=${type} | to=${to} | EXCEPTION: ${sendError}`)
    await logEmail({ supabase, userId, to, type, reportId, status: 'failed', errorMessage: sendError })
    return { sent: false, reason: `Send exception: ${sendError}` }
  }

  // ── Log the successful send ───────────────────────────────────────────────
  await logEmail({ supabase, userId, to, type, reportId, status: 'sent', messageId })

  return { sent: true, messageId }
}

// ─── Internal log helper ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logEmail(opts: {
  supabase:      any
  userId:        string
  to:            string
  type:          EmailType
  reportId?:     string
  status:        'sent' | 'failed' | 'skipped'
  messageId?:    string
  errorMessage?: string
}) {
  const { supabase, userId, to, type, reportId, status, messageId, errorMessage } = opts
  try {
    await supabase.from('email_logs').insert({
      user_id:             userId,
      email_type:          type,
      report_id:           reportId           ?? null,
      recipient_email:     to,
      status,
      provider_message_id: messageId          ?? null,
      error_message:       errorMessage       ?? null,
    })
  } catch {
    // Non-fatal — best-effort logging
  }
}
