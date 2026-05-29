/**
 * ─── Analytics event tracking ────────────────────────────────────────────────
 *
 * Lightweight client-side event tracker. Events are posted to /api/analytics
 * which stores them in Supabase (if the table exists) and logs them.
 *
 * Required SQL migration (run once in Supabase Dashboard → SQL Editor):
 *
 *   CREATE TABLE IF NOT EXISTS analytics_events (
 *     id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id     uuid,
 *     event_name  text        NOT NULL,
 *     properties  jsonb,
 *     created_at  timestamptz DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS analytics_events_name ON analytics_events(event_name);
 *   CREATE INDEX IF NOT EXISTS analytics_events_user ON analytics_events(user_id);
 */

export type AnalyticsEventName =
  | 'signup_started'
  | 'signup_completed'
  | 'email_verification_sent'
  | 'email_verified'
  | 'verification_resend_clicked'
  | 'password_validation_failed'
  | 'report_email_sent'
  | 'monthly_report_email_sent'
  | 'midmonth_email_sent'
  | 'abandoned_paywall_email_sent'
  | 'checkout_abandoned'
  | 'checkout_recovered'
  | 'paywall_viewed'
  | 'onboarding_type_selected'
  | 'nonprofit_onboarding_completed'

/**
 * Fire an analytics event.
 * Silently swallows errors — analytics must never break the main flow.
 */
export function trackEvent(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>,
  userId?: string,
): void {
  // Non-blocking: fire and forget
  fetch('/api/analytics', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ event, properties, userId }),
  }).catch(() => { /* silent */ })
}
