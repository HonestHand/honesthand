/**
 * ─── Email HTML templates ────────────────────────────────────────────────────
 *
 * All templates share the same header / footer shell.
 * Inline styles only — email clients strip external CSS.
 * Max content width: 560px.
 */

const BASE_URL = 'https://yourhonesthand.com'

// ─── Shared shell ─────────────────────────────────────────────────────────────

function shell(body: string, footerNote: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HonestHand</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:system-ui,-apple-system,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#1D9E75;padding:24px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">
            Honest<span style="opacity:0.75;">Hand</span>
          </span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 32px 24px;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #F3F4F6;">
          <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.7;">
            HonestHand · ${BASE_URL} · Texas · Est. 2026<br>
            For informational purposes only. Not financial, legal, or tax advice.<br>
            ${footerNote}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function ctaButton(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr><td>
      <a href="${href}"
         style="display:inline-block;background:#1D9E75;color:#FFFFFF;font-size:15px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none;">
        ${label} →
      </a>
    </td></tr>
  </table>`
}

// ─── Heading / paragraph helpers ─────────────────────────────────────────────

const h1 = (t: string) => `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#2C2C2A;line-height:1.3;">${t}</h1>`
const p  = (t: string) => `<p style="margin:0 0 16px;font-size:14px;color:#4B5563;line-height:1.7;">${t}</p>`
const li = (t: string) => `<li style="margin-bottom:8px;font-size:14px;color:#4B5563;line-height:1.6;">${t}</li>`

// ─── 1. Welcome email ─────────────────────────────────────────────────────────

export function welcomeEmail(params: { email: string }): { subject: string; html: string } {
  const subject = "Welcome to HonestHand — let's find your funding"
  const body = `
    ${h1("You're in. Let's get to work.")}
    ${p("HonestHand scans Texas grants, tax credits, federal loans, and government incentives — then shows you exactly which ones your business qualifies for and how to claim them.")}
    ${p("To get your personalized report, we need a few details about your business. It takes about 2 minutes.")}
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${li('Industry and location')}
      ${li('Revenue range (approximate is fine)')}
      ${li('Ownership type — veteran, minority, or woman-owned status unlocks additional programs')}
    </ul>
    ${p("Once your profile is complete, we'll run a live search against current programs and build your report.")}
    ${ctaButton("Complete My Profile", `${BASE_URL}/onboarding`)}
    ${p('<br>Questions? Reply to this email or visit <a href="${BASE_URL}/contact" style="color:#1D9E75;">our contact page</a>.')}
  `
  return { subject, html: shell(body, `You're receiving this because you created a HonestHand account with ${params.email}.`) }
}

// ─── 2. Free report ready ─────────────────────────────────────────────────────

export function freeReportReadyEmail(params: {
  businessName: string
}): { subject: string; html: string } {
  const { businessName } = params
  const subject = `Your HonestHand preview is ready, ${businessName}`
  const body = `
    ${h1(`Your funding preview is ready.`)}
    ${p(`We've put together a preview report for <strong>${businessName}</strong> showing a sample of the grants, loans, and incentives available to businesses like yours in Texas.`)}
    ${p("This preview shows what the full report looks like. To unlock every program we found — including local city and county programs, tax credits, certification pathways, and a 30-day action plan — upgrade to Pro.")}
    ${ctaButton("View My Preview Report", `${BASE_URL}/dashboard`)}
    ${p("<br>Your free preview will remain accessible in your dashboard.")}
  `
  return {
    subject,
    html: shell(body, `You're receiving this because you created a HonestHand account. To stop these emails, reply with "unsubscribe".`),
  }
}

// ─── 3. Pro report ready ──────────────────────────────────────────────────────

export function proReportReadyEmail(params: {
  businessName: string
}): { subject: string; html: string } {
  const { businessName } = params
  const subject = `Your full HonestHand report is ready — ${businessName}`
  const body = `
    ${h1("Your full report is ready.")}
    ${p(`We've completed a live search for <strong>${businessName}</strong> and your personalized funding report is ready to view.`)}
    ${p("Your report includes:")}
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${li("Federal grants and SBA programs")}
      ${li("Texas state incentives and loans")}
      ${li("Local city and county programs")}
      ${li("Tax credits and deductions")}
      ${li("Certification pathways (WOSB, HUBZone, 8(a), veteran)")}
      ${li("Government contracting opportunities")}
      ${li("A 30-day action plan — ranked from easiest win to most effort")}
    </ul>
    ${ctaButton("View My Full Report", `${BASE_URL}/dashboard`)}
    ${p("<br>Programs and deadlines change. Log in to review your opportunities before windows close.")}
  `
  return {
    subject,
    html: shell(body, `You're receiving this because you have an active HonestHand Pro subscription. To manage your emails, visit your account settings.`),
  }
}

// ─── 4. Pro subscription confirmed ───────────────────────────────────────────

export function proConfirmedEmail(params: {
  businessName: string
}): { subject: string; html: string } {
  const { businessName } = params
  const subject = "Your HonestHand Pro subscription is active"
  const body = `
    ${h1("Pro is active. Here's what you just unlocked.")}
    ${p(`<strong>${businessName}</strong> now has full access to HonestHand Pro.`)}
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${li("<strong>Full opportunity dashboard</strong> — every program we found, not just 3")}
      ${li("<strong>Grants, loans, tax credits & incentives</strong> — all categories")}
      ${li("<strong>Deadline tracking</strong> — so you never miss a window")}
      ${li("<strong>Monthly report refresh</strong> — updated every month with current programs")}
      ${li("<strong>Official .gov source links</strong> — every opportunity links back to the actual agency")}
    </ul>
    ${p("We're generating your first full report now. You'll receive another email when it's ready.")}
    ${ctaButton("Go to My Dashboard", `${BASE_URL}/dashboard`)}
    ${p("<br>Questions about your subscription? Visit <a href=\"${BASE_URL}/contact\" style=\"color:#1D9E75;\">our contact page</a> or reply to this email.")}
  `
  return {
    subject,
    html: shell(body, `You're receiving this because you activated HonestHand Pro. Cancel anytime — no long-term contracts. To manage your subscription, visit your account settings.`),
  }
}

// ─── 5. Monthly updated report ────────────────────────────────────────────────

export function monthlyReportEmail(params: {
  businessName: string
  monthYear:    string
}): { subject: string; html: string } {
  const { businessName, monthYear } = params
  const subject = `Your ${monthYear} HonestHand report is ready`
  const body = `
    ${h1(`Your ${monthYear} report is ready.`)}
    ${p(`We've run a fresh search for <strong>${businessName}</strong> and updated your report with the latest programs, funding amounts, and deadlines.`)}
    ${p("What we check every month:")}
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${li("New and renewed grant programs")}
      ${li("Updated SBA and federal program deadlines")}
      ${li("Texas state and local program cycles")}
      ${li("Tax credit changes and new incentives")}
    </ul>
    ${p("Programs open and close throughout the year. Log in now to see what's active and take action before deadlines pass.")}
    ${ctaButton("View My Updated Report", `${BASE_URL}/dashboard`)}
  `
  return {
    subject,
    html: shell(body, `You're receiving this because you have an active HonestHand Pro subscription. To manage your email preferences, visit your account settings.`),
  }
}

// ─── 6. Mid-month insight ─────────────────────────────────────────────────────

export function midMonthInsightEmail(params: {
  businessName: string
  monthYear:    string
}): { subject: string; html: string } {
  const { businessName, monthYear } = params
  const subject = `A funding reminder for ${businessName} — ${monthYear}`
  const body = `
    ${h1("A quick check-in from HonestHand.")}
    ${p(`We're halfway through ${monthYear}. A few things worth keeping in mind for <strong>${businessName}</strong>:`)}

    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #F3F4F6;">
        <div style="font-size:13px;font-weight:600;color:#2C2C2A;margin-bottom:4px;">📅 Check your deadlines</div>
        <div style="font-size:13px;color:#6B7280;line-height:1.6;">Some programs close at end-of-quarter or end-of-fiscal-year. If there are opportunities in your report with upcoming deadlines, now is a good time to act.</div>
      </td></tr>
      <tr><td style="padding:16px 20px;border-bottom:1px solid #F3F4F6;">
        <div style="font-size:13px;font-weight:600;color:#2C2C2A;margin-bottom:4px;">📋 Profile accuracy matters</div>
        <div style="font-size:13px;color:#6B7280;line-height:1.6;">Adding your county, entity type, and employee count helps us match you to local and size-based programs. If you haven't filled those in, it's worth doing before your next report refresh.</div>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <div style="font-size:13px;font-weight:600;color:#2C2C2A;margin-bottom:4px;">🏛️ Rolling programs are ready now</div>
        <div style="font-size:13px;color:#6B7280;line-height:1.6;">Programs marked "Rolling" in your report accept applications year-round — there's no deadline pressure, but there's also no reason to wait. Every month you delay is a month of eligible funding you're not claiming.</div>
      </td></tr>
    </table>

    ${ctaButton("Review My Report", `${BASE_URL}/dashboard`)}
  `
  return {
    subject,
    html: shell(body, `You're receiving this monthly check-in because you have an active HonestHand Pro subscription. To update your email preferences, visit your account settings.`),
  }
}

// ─── 7. Abandoned paywall follow-up ──────────────────────────────────────────

export function abandonedPaywallEmail(params: {
  businessName: string
  previewOpportunityCount?: number
}): { subject: string; html: string } {
  const { businessName, previewOpportunityCount } = params
  const countLine = previewOpportunityCount
    ? `Your preview shows ${previewOpportunityCount} example programs. The full report goes deeper — covering all 8 categories and 25+ real opportunities identified for your business.`
    : "Your business profile is complete and your full report is ready to generate."
  const subject = `${businessName} — your funding opportunities are still waiting`
  const body = `
    ${h1("Your funding opportunities are still here.")}
    ${p(`You set up a business profile for <strong>${businessName}</strong> and got a preview of what HonestHand found.`)}
    ${p(countLine)}
    ${p("The full report includes:")}
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${li("Every grant, loan, and tax credit we identified — not just a sample")}
      ${li("City and county programs specific to your location")}
      ${li("Certification pathways that can unlock set-aside contracts")}
      ${li("A 30-day action plan ranked from easiest win to most effort")}
      ${li("Verified deadlines and official .gov source links")}
    </ul>
    ${p("When you're ready to see the full picture, your report is one click away.")}
    ${ctaButton("View My Full Report", `${BASE_URL}/dashboard`)}
    ${p("<br>HonestHand Pro is $49/month. Cancel anytime.")}
  `
  return {
    subject,
    html: shell(body, `You're receiving this because you created a HonestHand account but haven't upgraded yet. To stop these emails, reply with "unsubscribe" or visit your account settings.`),
  }
}
