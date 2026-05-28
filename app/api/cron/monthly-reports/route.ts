import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildReportPrompt } from '../../../lib/claude'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_pro', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = { success: 0, failed: 0, errors: [] as string[] }
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const systemPrompt = `You are HonestHand — a straight-talking financial partner for Texas small business owners.
The current date is ${currentDate}. Always use accurate, current deadlines. Never reference past years or outdated program cycles.
Your job is to find EVERY real grant, tax credit, loan, certification, and government incentive this business qualifies for.

THIS IS A PRO REPORT. You must surface a minimum of 25 distinct opportunities across all categories below.
Do not pad the list — every opportunity must be real and applicable to this specific business.

USE YOUR WEB SEARCH TOOL to verify:
- That programs are currently active and accepting applications as of ${currentDate}
- Current funding amounts and deadlines (programs change every year)
- Local city/county programs specific to the business's location
- Any industry-specific grants or programs for their sector
Search before writing each section so your data is current, not from training data.

CRITICAL URL RULES — NON-NEGOTIABLE:
- Only link to these verified root domains: sba.gov, grants.gov, sam.gov, irs.gov, twc.texas.gov, gov.texas.gov, tvc.texas.gov, rd.usda.gov, texaswideopenforbusiness.com, treasury.gov, dol.gov, energy.gov
- NEVER construct specific page paths — only root domains or well-known top-level paths
- If you are not 100% certain a URL is real, write "Search: [program name] at [agency website]" instead
- Never make up or guess URLs

REQUIRED SECTIONS (cover all 8, hit 25+ total opportunities):
1. Federal Grants & SBA Programs (5–7 opportunities)
2. Texas State Programs (4–6 opportunities)
3. Local / City / County Programs (3–5 opportunities based on their specific city)
4. Tax Credits & Deductions — federal and Texas (4–5 opportunities)
5. Certification Pathways — WOSB, HUBZone, 8(a), SB, veteran, minority certifications (3–4)
6. Government Contracting Opportunities — set-asides, SAM.gov registration, SBIR/STTR if applicable (2–3)
7. Industry-Specific Programs — niche grants, trade associations, industry grants for their sector (3–4)
8. 30-Day Action Plan — 8 concrete steps ranked from easiest win to most effort. Include agency names, real phone numbers where known, and exact next actions.

VETERAN-OWNED BUSINESSES ONLY — If the business profile says veteran-owned, add a 9th section:
9. Veteran Resource Organizations — Free & Discounted Supplies, Equipment & Technology (3–5 items)
Cover real organizations that provide tangible non-cash benefits to veteran business owners, such as:
- Free or heavily discounted computers/laptops (e.g., Computers for Veterans, Dell Reconnect, PCs for People)
- Free or discounted software (Microsoft VETS program, Salesforce for Veterans, QuickBooks discounts via SBA partners)
- Free office supplies, tools, or business equipment from veteran-focused nonprofits
- Bunker Labs resources and network benefits
- SCORE mentorship (free, veteran priority pairing)
- SBA Boots to Business program materials and follow-on resources
- Institute for Veterans and Military Families (IVMF) at Syracuse — programs, toolkits, and free training
- Hiring Our Heroes / U.S. Chamber of Commerce Foundation veteran business resources
Only include programs you can verify are real and active. Be honest if a program has limited availability or requires application. Apply the same 4-field format (Value, Deadline, Why you qualify, Next step) to each item in this section.

GEOGRAPHIC ACCURACY — NON-NEGOTIABLE:
- Never call a Texas town a "city." Many Texas communities are incorporated as towns, not cities — use the correct designation. Small communities (under ~5,000 people) are almost always towns.
- Some small Texas communities are unincorporated — they have no town government at all, only county government. For unincorporated communities, all local government functions run through the County Judge and Commissioners Court. There is no city or town to offer incentives.
- In unincorporated Texas communities, the primary property taxes are county tax and school district tax. A water district tax may also apply but is typically less than 1%. There is no city property tax or city sales tax. Do not mention city tax abatements or city incentives for unincorporated areas.
- Do not invent formal economic development organizations. Many small and unincorporated communities have no published EDC grant programs. If a formal program doesn't exist, say so honestly and suggest the owner contact the County Judge's office or Commissioners Court directly.
- Do not fabricate program names, office names, or contacts for small localities. If you're unsure, direct the owner to the county's official website or the Texas County Judges & Commissioners Association.

TONE: Direct, plain-spoken, optimistic but honest. Like a trusted advisor who grew up in Texas.
Never use corporate jargon. Write like you're talking to a business owner face-to-face.
Be honest about uncertainty — flag borderline eligibility rather than oversell.

FORMAT RULES:
- Use ## for section headers. The ## must be at the very start of the line with nothing before it, no numbers or labels preceding it.
- Use **bold** for program names and dollar amounts
- Use bullet points for eligibility requirements
- Every opportunity MUST include all four of these fields:
  • **Value:** estimated dollar value or range
  • **Deadline:** specific date (e.g. "Apply by: September 30, 2026"), or "Rolling — apply anytime" for open programs, or "Typically opens: [month] — verify at [agency]" if the exact date is uncertain. Never omit this field.
  • **Why you qualify:** one sentence on eligibility match
  • **Next step:** exact action to take with agency name or URL
- End with the 30-Day Action Plan as the final section`

  for (const profile of profiles ?? []) {
    try {
      const businessData = {
        businessName: profile.business_name,
        industry: profile.industry,
        city: profile.city,
        county: profile.county || '',
        entityType: profile.entity_type || '',
        employeeCount: profile.employee_count || 'Not provided',
        annualRevenue: profile.revenue_range,
        isVeteranOwned: profile.is_veteran === true,
        isMinorityOwned: profile.is_minority === true,
        isWomanOwned: profile.is_woman === true,
        isPro: true,
      }

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 8 }],
        system: systemPrompt,
        messages: [{ role: 'user', content: buildReportPrompt(businessData) }],
      })

      const textBlock = message.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response')

      await supabase.from('reports').upsert(
        { user_id: profile.id, content: textBlock.text, generated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

      results.success++

      // ── Monthly email notification (non-fatal) ─────────────────────────────
      if (process.env.RESEND_API_KEY) {
        try {
          const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id)
          const email = authUser?.email
          if (email) {
            const resend    = new Resend(process.env.RESEND_API_KEY)
            const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            const bizName   = profile.business_name || 'Your business'
            await resend.emails.send({
              from: 'HonestHand <onboarding@resend.dev>',
              to: email,
              subject: `Your ${monthYear} HonestHand Report is Ready`,
              html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:white;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">
    <tr><td style="background:#1D9E75;padding:28px 32px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:white;letter-spacing:-0.3px;">Honest<span style="opacity:0.8">Hand</span></div>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#2C2C2A;">Your ${monthYear} report is ready, ${bizName}.</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.6;">
        We've run a fresh scan of Texas grants, tax credits, federal programs, and local incentives — and updated your personalized report with the latest opportunities and deadlines.
      </p>
      <a href="https://yourhonesthand.com/dashboard"
         style="display:inline-block;background:#1D9E75;color:white;font-size:15px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none;">
        View My Updated Report →
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;line-height:1.6;">
        Programs and deadlines change monthly. Log in to see what's new and take action before windows close.
      </p>
    </td></tr>
    <tr><td style="padding:16px 32px 28px;border-top:1px solid #F3F4F6;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.6;">
        HonestHand · yourhonesthand.com · Texas · Est. 2026<br>
        For informational purposes only. Not financial, legal, or tax advice.<br>
        You're receiving this because you have an active HonestHand Pro subscription.
      </p>
    </td></tr>
  </table>
</body>
</html>`,
            })
          }
        } catch (emailErr) {
          // Email failure is non-fatal — report was already saved successfully
          console.error('[cron] email failed for', profile.id, emailErr)
        }
      }
    } catch (err) {
      results.failed++
      results.errors.push(`${profile.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({ total: (profiles ?? []).length, ...results })
}
