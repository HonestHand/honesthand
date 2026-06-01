import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildReportPrompt, buildNonprofitReportPrompt, NonprofitData } from '../../../lib/claude'
import { sendEmail } from '../../../lib/emailSender'
import { monthlyReportEmail } from '../../../lib/emailTemplates'

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

ENTITY TYPE ENFORCEMENT — HARD RULE:
Read the entity type from the business profile first.
- LLC, Sole Proprietorship, S-Corp, C-Corp, Corporation, Partnership = FOR-PROFIT
  → NEVER include: nonprofit programs, 501(c) grants, tax-exempt programs, charitable grants, donor-funded programs
  → These do not apply to for-profit businesses — omit entirely
- "Why you qualify" bullets must describe only business attributes. Never describe the program itself.
- Never split a dollar amount: "$50,000" is one value, never "$50" and "000" separately.
- "Why you qualify" = business characteristics only. "Next step" = one clear action only. Never duplicate across fields.

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
  • **Deadline:** timing/date ONLY — a specific date, "Rolling — apply anytime", or "Typically opens: [season] — verify at [agency]". NEVER put action instructions, form numbers, or contact info in the Deadline field. Those belong in Next step.
  • **Why you qualify:** one sentence on eligibility match
  • **Next step:** exact action to take with agency name or URL
- End with the 30-Day Action Plan as the final section
- Do NOT include "Not Applicable" entries. If a program does not apply, omit it entirely. Only include programs this business can actually pursue.
- **Why you qualify:** max 2 bullet phrases, one attribute each. No sentences. Example: "- LLC\\n- Rural Texas location"
- **Value:** amount + instrument only, one line. No deadline text in Value field.
- **Next step:** one sentence, one action, max 120 chars.
- No duplication between Why qualify / Value / Deadline / Next step fields.
- Tax credits: always include the specific IRS/TWC form and a dollar estimate.`

  const nonprofitSystemPrompt = `You are HonestHand — a straight-talking funding partner for Texas nonprofits and community organizations.
The current date is ${currentDate}. Always use accurate, current deadlines and grant cycles. Never reference past years or outdated grant cycles.
Your job is to find EVERY real foundation grant, government grant, corporate sponsorship, and capacity-building resource this nonprofit qualifies for.

THIS IS A PRO NONPROFIT REPORT. You must surface a minimum of 25 distinct opportunities across all categories below.

USE YOUR WEB SEARCH TOOL to verify grant cycles and deadlines are current as of ${currentDate}.

CRITICAL URL RULES: Only link to verified root domains for government agencies and well-known foundations. Write "Search: [program name] at [funder]" if uncertain. Never guess URLs.

REQUIRED SECTIONS (cover all 8, 25+ opportunities total):
1. Foundation Grants — Private & Community Foundations (5–7)
2. Federal & Government Grants (4–6)
3. Texas State Funding for Nonprofits (3–5)
4. Local / City / County Funding (2–4)
5. Corporate Sponsorships & Giving Programs (3–5)
6. Capacity Building, Technology & Organizational Development (3–4)
7. Program-Specific & Mission-Aligned Funding (3–4)
8. 30-Day Grant Readiness Action Plan — 8 concrete steps

GEOGRAPHIC ACCURACY: Never call a Texas town a "city." Do not invent foundation programs for small localities.
LANGUAGE RULES: Use nonprofit language (mission, programs, community impact, populations served, operating support, grant readiness). Do NOT use business/revenue/profit language.
TONE: Direct, mission-focused, honest. Like a trusted grants consultant who knows Texas nonprofits.

FORMAT RULES:
- ## for section headers (at line start, no preceding text)
- **bold** for program names and dollar amounts
- Every opportunity MUST include: **Value:**, **Deadline:**, **Why you qualify:**, **Next step:**`

  for (const profile of profiles ?? []) {
    try {
      const isNonprofit = profile.user_type === 'nonprofit'

      let reportPrompt: string
      let activeSystemPrompt: string

      if (isNonprofit) {
        const nonprofitData: NonprofitData = {
          orgName:          profile.business_name,
          missionArea:      profile.mission_area       || 'General nonprofit services',
          is501c3:          profile.is_501c3            === true,
          ein:              profile.ein                 || undefined,
          city:             profile.city,
          county:           profile.county              || '',
          populationsServed: profile.populations_served || undefined,
          annualBudget:     profile.annual_budget       || undefined,
          yearsOperating:   profile.years_operating     || undefined,
          orgFocus:         profile.org_focus
                              ? (profile.org_focus as string).split(',').filter(Boolean)
                              : [],
          fundingTypeNeeds: profile.funding_type_needs
                              ? (profile.funding_type_needs as string).split(',').filter(Boolean)
                              : [],
          grantHistory:     profile.grant_history       || undefined,
          isPro: true,
        }
        reportPrompt      = buildNonprofitReportPrompt(nonprofitData)
        activeSystemPrompt = nonprofitSystemPrompt
      } else {
        const businessData = {
          businessName: profile.business_name,
          industry:     profile.industry,
          city:         profile.city,
          county:       profile.county        || '',
          entityType:   profile.entity_type   || '',
          employeeCount: profile.employee_count || 'Not provided',
          annualRevenue: profile.revenue_range,
          isVeteranOwned:  profile.is_veteran  === true,
          isMinorityOwned: profile.is_minority === true,
          isWomanOwned:    profile.is_woman    === true,
          isPro: true,
        }
        reportPrompt      = buildReportPrompt(businessData)
        activeSystemPrompt = systemPrompt
      }

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 8 }],
        system: activeSystemPrompt,
        messages: [{ role: 'user', content: reportPrompt }],
      })

      const textBlock = message.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response')

      await supabase.from('reports').upsert(
        { user_id: profile.id, content: textBlock.text, generated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

      results.success++

      // ── Monthly report email (non-fatal, deduplicated) ─────────────────────
      try {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id)
        const toEmail = authUser?.email
        if (toEmail) {
          // Respect email_monthly_reports preference (default true if column missing)
          const prefOk = profile.email_monthly_reports !== false
          if (prefOk) {
            const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            const bizName   = profile.business_name || 'Your organization'
            const userType  = (profile.user_type === 'nonprofit' ? 'nonprofit' : 'business') as 'business' | 'nonprofit'
            const template  = monthlyReportEmail({ businessName: bizName, monthYear, userType })
            const result    = await sendEmail({
              userId:  profile.id,
              to:      toEmail,
              type:    'monthly_report',
              subject: template.subject,
              html:    template.html,
            })
            if (!result.sent) {
              console.log('[cron] monthly email not sent for', profile.id, ':', result.reason)
            }
          }
        }
      } catch (emailErr) {
        // Email failure is non-fatal — report was already saved successfully
        console.error('[cron] email error for', profile.id, emailErr)
      }
    } catch (err) {
      results.failed++
      results.errors.push(`${profile.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({ total: (profiles ?? []).length, ...results })
}
