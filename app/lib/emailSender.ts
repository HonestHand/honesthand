/**
 * ─── Email sender with deduplication ─────────────────────────────────────────
 *
 * All outbound emails flow through this module.
 * Before sending, it checks `email_logs` (if available) to prevent duplicate
 * sends within the configured cooldown window.
 *
 * Required SQL migration (run once in Supabase Dashboard → SQL Editor):
 *
 *   CREATE TABLE IF NOT EXISTS email_logs (
 *     id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id     uuid        NOT NULL,
 *     email_type  text        NOT NULL,
 *     report_id   text,
 *     sent_at     timestamptz DEFAULT now(),
 *     status      text        DEFAULT 'sent'
 *   );
 *   CREATE INDEX IF NOT EXISTS email_logs_user_type ON email_logs(user_id, email_type);
 *   CREATE INDEX IF NOT EXISTS email_logs_sent_at   ON email_logs(sent_at);
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
  sent:    boolean
  reason?: string
}

// ─── Core send function ───────────────────────────────────────────────────────

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const { userId, to, type, subject, html, reportId } = opts

  if (!process.env.RESEND_API_KEY) {
    console.warn('[emailSender] RESEND_API_KEY not configured — skipping send')
    return { sent: false, reason: 'RESEND_API_KEY not set' }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── Deduplication check ──────────────────────────────────────────────────
  try {
    if (SEND_ONCE.includes(type)) {
      // Send-once: reject if any prior record exists
      const { data } = await supabase
        .from('email_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', type)
        .limit(1)
      if (data && data.length > 0) {
        return { sent: false, reason: `${type} already sent to this user` }
      }
    } else if ((type === 'report_ready_free' || type === 'report_ready_pro') && reportId) {
      // Per-report dedup: one email per unique reportId
      const { data } = await supabase
        .from('email_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', type)
        .eq('report_id', reportId)
        .limit(1)
      if (data && data.length > 0) {
        return { sent: false, reason: `report-ready email already sent for this report` }
      }
    } else if (COOLDOWN_DAYS[type]) {
      // Cooldown-based: reject if sent within the cooldown window
      const cutoff = new Date(
        Date.now() - (COOLDOWN_DAYS[type]! * 24 * 60 * 60 * 1000)
      ).toISOString()
      const { data } = await supabase
        .from('email_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', type)
        .gte('sent_at', cutoff)
        .limit(1)
      if (data && data.length > 0) {
        return { sent: false, reason: `${type} sent within cooldown window` }
      }
    }
  } catch (err) {
    // email_logs table may not exist yet → fail open (send anyway, skip dedup)
    console.warn('[emailSender] dedup check failed — sending anyway:', err)
  }

  // ── Send via Resend ──────────────────────────────────────────────────────
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    'HonestHand <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[emailSender] send failed:', msg)
    return { sent: false, reason: `Send error: ${msg}` }
  }

  // ── Log the send ─────────────────────────────────────────────────────────
  try {
    await supabase.from('email_logs').insert({
      user_id:    userId,
      email_type: type,
      report_id:  reportId ?? null,
      status:     'sent',
    })
  } catch {
    // Non-fatal — we already sent successfully; log failure is OK
  }

  return { sent: true }
}
