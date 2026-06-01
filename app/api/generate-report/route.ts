import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildReportPrompt, buildNonprofitReportPrompt, NonprofitData } from '../../lib/claude'
import { classifyError, sendAdminAlert, FLOW_MESSAGES } from '../../lib/reportErrors'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const profile = await request.json()

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const isPro = profile.is_pro === true || profile.is_pro === 'true'
  const isNonprofit = profile.user_type === 'nonprofit'

  let prompt: string

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
      currentPrograms:  profile.current_programs    || undefined,
      fundingGoals:     profile.funding_goals       || undefined,
      grantHistory:     profile.grant_history       || undefined,
      orgFocus:         profile.org_focus
                          ? (profile.org_focus as string).split(',').filter(Boolean)
                          : [],
      fundingTypeNeeds: profile.funding_type_needs
                          ? (profile.funding_type_needs as string).split(',').filter(Boolean)
                          : [],
      isPro,
    }
    console.log('[generate-report] nonprofitData:', JSON.stringify(nonprofitData, null, 2))
    prompt = buildNonprofitReportPrompt(nonprofitData)
  } else {
    const businessData = {
      businessName:        profile.business_name,
      industry:            profile.industry,
      businessDescription: profile.business_description || undefined,
      city:                profile.city,
      county:              profile.county        || '',
      entityType:          profile.entity_type   || '',
      employeeCount:       profile.employee_count || 'Not provided',
      annualRevenue:       profile.revenue_range,
      isVeteranOwned:      profile.is_veteran  === true,
      isMinorityOwned:     profile.is_minority === true,
      isWomanOwned:        profile.is_woman    === true,
      customerSegments:    profile.customer_segments
                             ? (profile.customer_segments as string).split(',').filter(Boolean)
                             : undefined,
      isPro,
    }
    console.log('[generate-report] businessData:', JSON.stringify(businessData, null, 2))
    prompt = buildReportPrompt(businessData)
  }
  const encoder = new TextEncoder()
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const proSystemPrompt = `You are HonestHand — a straight-talking financial partner for Texas small business owners.
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
- NEVER construct specific page paths — only root domains or well-known top-level paths like sba.gov/funding-programs
- If you are not 100% certain a URL is real, write "Search: [program name] at [agency website]" instead
- Never make up or guess URLs — a broken link is worse than no link

ENTITY TYPE ENFORCEMENT — HARD RULE:
Read the entity type from the business profile first. It is non-negotiable.
- LLC, Sole Proprietorship, S-Corp, C-Corp, Corporation, Partnership = FOR-PROFIT
  → NEVER include: nonprofit programs, 501(c) grants, tax-exempt programs, charitable organization grants, donor-funded programs, or foundation grants restricted to nonprofits
  → These programs do not apply to a for-profit business — omit them entirely, do not suggest them as "worth looking into"
- Nonprofit, 501(c)(3), NGO = NONPROFIT entity (use the nonprofit prompt instead)

QUALIFICATION BULLETS — HARD RULES:
The "Why you qualify" field must describe ONLY attributes the business itself has.
✓ Valid: entity type ("LLC"), ownership ("Veteran-owned", "Woman-owned"), industry ("Texas retail business"), geography ("West Texas location"), revenue stage ("Under $100k annual revenue"), business age ("Early-stage business")
✗ Invalid: anything describing the program, what the program offers, incomplete fragments, or split dollar values

Never generate "Why you qualify" text that:
- Starts with: "This", "Program", "Offering", "Provides", "Designed for", "If you", "Supports"
- Describes the program instead of the business
- Splits a dollar amount ("$50,000" is one value — never write "$50" separate from "000")
- Is fewer than 3 words or an incomplete clause

DOLLAR AMOUNT FORMATTING — NEVER FRAGMENT:
Always write complete dollar amounts as a single unit: "$25,000 grant" | "Up to $500,000 loan" | "$5,000–$50,000"
Commas inside numbers are part of the number. Never separate them.

SECTION DUPLICATION — PROHIBITED:
- "Why you qualify" = business characteristics ONLY (never repeat program info)
- "Next step" = one clear action ONLY (never repeat eligibility info)
- Never copy the same sentence into two different fields

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
- Some small Texas communities are unincorporated — they have no town government at all, only county government. Ozona (Crockett County) is an example. For unincorporated communities, there is no city or town to offer incentives — all local government functions run through the County Judge and Commissioners Court.
- In unincorporated Texas communities, the primary property taxes are county tax and school district tax. A water district tax may also apply but is typically less than 1%. There is no city property tax or city sales tax because there is no incorporated municipality. Do not mention city tax abatements or city incentives for unincorporated areas.
- Do not invent formal economic development organizations. Many small and unincorporated communities have no published EDC grant programs. If a formal program doesn't exist, say so honestly and suggest the owner contact the County Judge's office or Commissioners Court directly about discretionary incentives (county tax abatements, fee waivers, connections to state programs, etc.).
- Do not fabricate program names, office names, or contacts for small localities. If you're unsure, direct the owner to the county's official website or the Texas County Judges & Commissioners Association.

TONE: Direct, plain-spoken, optimistic but honest. Like a trusted advisor who grew up in Texas.
Never use corporate jargon. Write like you're talking to a business owner face-to-face.
Be honest about uncertainty — flag borderline eligibility rather than oversell.

FORMAT RULES:
- Use ## for section headers. The ## must be at the very start of the line with nothing before it, no numbers or labels preceding it.
- Use **bold** for program names and dollar amounts
- Use bullet points for eligibility requirements
- Every opportunity MUST include all four of these fields:
  • **Value:** dollar amount + instrument type only. One line. No deadline text. No caveats.
    CORRECT: "$25,000 grant" | "Up to $9,600 per qualifying new hire" | "Up to $500,000 loan"
  • **Deadline:** timing/date ONLY. Must contain a date, rolling status, or cycle timing — NOTHING ELSE.
    CORRECT: "Apply by: September 30, 2026" | "Rolling — apply anytime" | "Typically opens: September — verify at sba.gov"
    NEVER put action instructions in Deadline: "File Form 8850 within 28 days" belongs in Next step, NOT Deadline.
    If no specific deadline is known: write "Rolling — apply anytime" or "Typically opens: [season/month] — verify at [agency]"
  • **Why you qualify:** 1–2 short bullet phrases, each = one business attribute. NO sentences.
    CORRECT: "- Veteran-owned LLC\n  - Rural Texas location" | "- Under $100k revenue\n  - Texas-based business"
    WRONG: "You qualify because you are a veteran-owned LLC operating in rural Texas..."
  • **Next step:** ONE action sentence, max 120 chars.
    CORRECT: "Contact TWC at (512) 463-2222." | "File IRS Form 8850 with TWC within 28 days of hire."
    NEVER chain multiple steps or repeat qualification context.
- End with the 30-Day Action Plan as the final section
- Do NOT include a business profile summary, context block, or header at the top of any section. Never echo back the business name, location, or ownership flags as a formatted bold item. Start each section directly with the first opportunity.
- Do NOT include "Not Applicable" entries. If a program does not apply to this business, omit it entirely — do not list it with a "Not Applicable" label or explanation. The report should contain only programs this business can actually pursue.

STRICT FIELD CONTRACTS — ZERO TOLERANCE FOR DUPLICATION:

**Why you qualify** = business attributes ONLY. Max 2 bullet lines. One attribute per line.
  CORRECT (copy this format):
  - Veteran-owned LLC
  - Rural West Texas location
  NEVER: sentences, "you qualify because", "this program is designed for", or anything about the program.

**Value** = dollar amount + instrument only. One short line. No deadline text. No caveats.
  CORRECT: "$25,000 grant" | "Up to $500,000 loan" | "Up to $9,600 per qualifying new hire"
  NEVER: "rolling application", "verify with agency", parenthetical explanations in this field.

**Deadline** = timing only, one line.
  CORRECT: "Apply by: March 31, 2026" | "Rolling — apply anytime" | "Typically opens: September — verify at sba.gov"

**Next step** = ONE immediate action. One sentence. Max 120 characters.
  CORRECT: "Contact TWC at (512) 463-2222." | "Search 'SBA Microloan Texas' at sba.gov." | "File IRS Form 8850 within 28 days of hire."
  NEVER: multiple actions joined by "then", "also", or semicolons.

DUPLICATION = FAILURE. Each field must contain information that appears NOWHERE ELSE in the same opportunity.

TAX CREDITS — SPECIFIC RULES:
  Always state the annual dollar value estimate (not "varies"). State what triggers the credit. Include the IRS form.
  Value example: "Up to $9,600 per qualifying new hire (veteran hire = max credit)"
  Why example: "- Hires veterans (WOTC eligible target group)"
  Next step example: "File IRS Form 8850 with TWC within 28 days of first day of work."

INDIRECT PROGRAMS: If a program funds public entities or nonprofits rather than businesses directly, write in Why:
  "- Accessible via local public entity or nonprofit partner" — do NOT imply direct access.`

  const freeSystemPrompt = `You are HonestHand — a straight-talking financial partner for Texas small business owners.
The current date is ${currentDate}. Always use accurate, current deadlines. Never reference past years or outdated program cycles.
Your job is to find real grants, tax credits, and government incentives they actually qualify for.

Generate a preview report with the top 3 sections only: Federal Programs, Texas State Programs, and Tax Credits.
Include 2–3 opportunities per section. Make each one count — real programs, accurate values, honest eligibility.

USE YOUR WEB SEARCH TOOL to confirm each program is currently active and open as of ${currentDate} before including it.

CRITICAL URL RULES — NON-NEGOTIABLE:
- Only link to these verified root domains: sba.gov, grants.gov, sam.gov, irs.gov, twc.texas.gov, gov.texas.gov, tvc.texas.gov, rd.usda.gov, texaswideopenforbusiness.com, treasury.gov, dol.gov, energy.gov
- If you are not 100% certain a URL is real, write "Search: [program name] at [agency website]" instead
- Never make up or guess URLs

ENTITY TYPE ENFORCEMENT — HARD RULE:
- LLC, Sole Proprietorship, S-Corp, C-Corp, Corporation, Partnership = FOR-PROFIT
  → NEVER include nonprofit programs, 501(c) grants, tax-exempt programs, or charitable grants
- "Why you qualify" bullets must describe only business attributes (entity type, ownership, industry, location, revenue). Never describe the program.
- Never split a dollar amount: "$50,000" is one value — never write "$50" and "000" separately.

GEOGRAPHIC ACCURACY — NON-NEGOTIABLE:
- Never call a Texas town a "city." Small communities (under ~5,000 people) are almost always towns, not cities — use the correct designation.
- Some small Texas communities are unincorporated (no town government — only county). For those, primary taxes are county and school district; water district may apply at under 1%. There is no city tax. Do not reference city incentives or city tax abatements for unincorporated areas.
- Do not invent formal economic development organizations for small localities. If no published program exists, say so and suggest contacting the County Judge's office directly.

TONE: Direct, plain-spoken, optimistic but honest. Like a trusted advisor who grew up in Texas.

FORMAT RULES:
- Use ## for section headers. The ## must be at the very start of the line with nothing before it.
- Use **bold** for program names and dollar amounts
- Use bullet points for eligibility requirements
- Every opportunity MUST include all four of these fields:
  • **Value:** estimated dollar value or range
  • **Deadline:** specific date (e.g. "Apply by: September 30, 2026"), or "Rolling — apply anytime" for open programs, or "Typically opens: [month] — verify at [agency]" if the exact date is uncertain. Never omit this field.
  • **Why you qualify:** one sentence on eligibility match
  • **Next step:** exact action to take with agency name or URL
- Do NOT include a business profile summary or context block. Never echo the business name, location, or ownership flags as a formatted bold item. Start each section directly with the first opportunity.
- **Why you qualify:** max 2 bullet phrases, one attribute each (entity type / ownership / industry / location / revenue). No sentences. Example: "- LLC\\n- Under $100k revenue"
- **Value:** amount + instrument only, one line. No deadline text.
- **Next step:** one sentence, one action, max 120 chars.
- No duplication between fields.`

  // ── Nonprofit system prompts ────────────────────────────────────────────────
  const nonprofitProSystemPrompt = `You are HonestHand — a straight-talking funding partner for Texas nonprofits and community organizations.
The current date is ${currentDate}. Always use accurate, current deadlines and grant cycles. Never reference past years or outdated grant cycles.
Your job is to find EVERY real foundation grant, government grant, corporate sponsorship, and capacity-building resource this nonprofit qualifies for.

THIS IS A PRO NONPROFIT REPORT. You must surface a minimum of 25 distinct opportunities across all categories below.
Do not pad the list — every opportunity must be real and applicable to this specific organization and mission area.

USE YOUR WEB SEARCH TOOL to verify:
- That grant programs are currently active and accepting applications or LOIs as of ${currentDate}
- Current grant amounts, deadlines, and eligibility requirements (grant cycles change every year)
- Local foundation programs specific to the organization's city and county
- Mission-aligned national and Texas funders for this specific mission area
Search before writing each section so your data is current, not from training data.

CRITICAL URL RULES — NON-NEGOTIABLE:
- Only link to these verified root domains: grants.gov, sam.gov, hhs.gov, hrsa.gov, justice.gov, hud.gov, ed.gov, usda.gov, arts.gov, acl.gov, acf.hhs.gov, fema.gov, dol.gov, hhs.texas.gov, tpwd.texas.gov, tda.texas.gov, gov.texas.gov, txcourts.gov
- For foundation websites, only link to root domains you are 100% certain exist (e.g., kresge.org, gatesfoundation.org, houstondowment.org, cftexas.org)
- NEVER construct specific page paths — only root domains or well-known top-level paths like grants.gov/search-grants
- If you are not 100% certain a URL is real, write "Search: [program name] at [foundation/agency name]" instead
- Never make up or guess URLs — a broken link is worse than no link

REQUIRED SECTIONS (cover all 8, hit 25+ total opportunities):
1. Foundation Grants — Private & Community Foundations (5–7 opportunities)
2. Federal & Government Grants (4–6 opportunities)
3. Texas State Funding for Nonprofits (3–5 opportunities)
4. Local / City / County Funding (2–4 opportunities based on their specific location)
5. Corporate Sponsorships & Giving Programs (3–5 opportunities)
6. Capacity Building, Technology & Organizational Development (3–4 opportunities)
7. Program-Specific & Mission-Aligned Funding (3–4 opportunities)
8. 30-Day Grant Readiness Action Plan — 8 concrete steps ranked from easiest win to most strategic. Start with free registrations (SAM.gov, GuideStar/Candid, grants.gov) that unlock additional funding. Include real contact info or URLs where known.

GEOGRAPHIC ACCURACY — NON-NEGOTIABLE:
- Never call a Texas town a "city." Many Texas communities are incorporated as towns, not cities — use the correct designation.
- Some small Texas communities are unincorporated — they have no town government at all, only county government.
- Do not invent formal community foundation programs for small localities. Many small Texas communities have limited local foundation infrastructure. Be honest.
- If local programs are hard to verify for a small community, say so and direct the org to contact their county judge's office or the United Way chapter for their region.

LANGUAGE RULES — NON-NEGOTIABLE:
- Use nonprofit language throughout: mission, programs, community impact, populations served, operating support, grant readiness, donor alignment, capacity building
- Do NOT use: revenue growth, business expansion, small business loans, tax credits for businesses, profit, customers
- Write to a nonprofit leader — executive director, program director, board member — not a business owner
- For organizations WITHOUT confirmed 501(c)(3) status: note which opportunities require it, and suggest fiscal sponsorship as a near-term path forward

TONE: Direct, mission-focused, and genuinely helpful. Like a trusted grants consultant who knows Texas nonprofits.
Be honest about borderline eligibility — flag it rather than oversell. If a small or new organization faces more competition for certain grants, say so plainly.

FORMAT RULES:
- Use ## for section headers. The ## must be at the very start of the line with nothing before it, no numbers or labels preceding it.
- Use **bold** for program names and dollar amounts
- Use bullet points for eligibility requirements
- Every opportunity MUST include all four of these fields:
  • **Value:** estimated grant size or range
  • **Deadline:** specific date (e.g. "LOI by: October 15, 2026"), or "Rolling — apply anytime", or "Typically opens: [month] — verify with funder" if the exact date is uncertain. Never omit this field.
  • **Why you qualify:** one sentence on eligibility match
  • **Next step:** exact action to take with funder name or URL
- End with the 30-Day Grant Readiness Action Plan as the final section
- Do NOT include an organization profile summary or context block. Never echo the org name, location, or 501(c)(3) status as a formatted bold item. Start each section directly with the first opportunity.`

  const nonprofitFreeSystemPrompt = `You are HonestHand — a straight-talking funding partner for Texas nonprofits and community organizations.
The current date is ${currentDate}. Always use accurate, current deadlines and grant cycles.

Generate a preview nonprofit funding report with the top 3 sections only: Foundation Grants, Government Grants, and Capacity Building.
Include 2–3 opportunities per section. Make each one count — real programs, accurate grant amounts, honest eligibility.

USE YOUR WEB SEARCH TOOL to confirm each program is currently active and accepting applications or LOIs as of ${currentDate} before including it.

CRITICAL URL RULES — NON-NEGOTIABLE:
- Only link to these verified root domains: grants.gov, sam.gov, hhs.gov, arts.gov, hhs.texas.gov, gov.texas.gov
- For foundations, only link to root domains you are 100% certain exist
- If you are not 100% certain a URL is real, write "Search: [program name] at [agency/foundation]" instead
- Never make up or guess URLs

LANGUAGE RULES — NON-NEGOTIABLE:
- Use nonprofit language: mission, programs, community impact, operating support, grant readiness
- Do NOT use: business, revenue, profit

TONE: Direct, mission-focused, honest. Like a grants consultant who knows Texas nonprofits.

FORMAT RULES:
- Use ## for section headers. The ## must be at the very start of the line with nothing before it.
- Use **bold** for program names and dollar amounts
- Use bullet points for eligibility requirements
- Every opportunity MUST include all four of these fields:
  • **Value:** estimated grant size or range
  • **Deadline:** specific date or cycle — never omit this field
  • **Why you qualify:** one sentence on eligibility match
  • **Next step:** exact action to take with funder name or URL
- Do NOT include an organization profile summary or context block. Never echo the org name, location, or mission as a formatted bold item. Start each section directly with the first grant opportunity.`

  // ── Select the right system prompt ──────────────────────────────────────────
  const selectedSystemPrompt = isNonprofit
    ? (isPro ? nonprofitProSystemPrompt : nonprofitFreeSystemPrompt)
    : (isPro ? proSystemPrompt : freeSystemPrompt)

  // ── Supabase admin client (for rate limiting + job tracking) ─────────────────
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const userId       = profile.id as string | undefined
  const businessName = (profile.business_name ?? profile.orgName ?? '') as string
  const STALE_THRESHOLD_MS = 10 * 60 * 1000  // 10 minutes

  if (userId) {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()

    // ── Step 1: Auto-recover stale jobs (stuck > 10 min) ─────────────────────
    try {
      const { data: staleJobs } = await supabaseAdmin
        .from('report_generation_jobs')
        .update({
          status:             'failed',
          failed_at:          new Date().toISOString(),
          error_code:         'STALE_JOB_TIMEOUT',
          sanitized_error:    'Job timed out without completing.',
        })
        .in('status', ['processing', 'queued', 'retrying'])
        .eq('user_id', userId)
        .lt('started_at', staleThreshold)
        .select('id')

      if (staleJobs && staleJobs.length > 0) {
        console.warn(`[generate-report] Recovered ${staleJobs.length} stale job(s) for user ${userId}`)
        void sendAdminAlert({
          code:         'STALE_JOB_TIMEOUT' as const,
          rawError:     `${staleJobs.length} stale job(s) auto-recovered for user ${userId}`,
          userId,
          businessName,
          attemptCount: 0,
        })
      }
    } catch (e) {
      console.error('[generate-report] Stale job cleanup failed (non-critical):', e)
    }

    // ── Step 2: Block only if a FRESH active job exists (<10 min old) ────────
    const { data: activeJob } = await supabaseAdmin
      .from('report_generation_jobs')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['processing', 'queued', 'retrying'])
      .gte('started_at', staleThreshold)
      .limit(1)
      .maybeSingle()

    if (activeJob) {
      const msg = FLOW_MESSAGES['REPORT_IN_PROGRESS']
      return new Response(
        `data: ${JSON.stringify({ error: msg, errorCode: 'REPORT_IN_PROGRESS' })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
      )
    }
  }

  // ── Create job record (awaited so ID is available for finally cleanup) ───────
  let currentJobId: string | undefined
  if (userId) {
    try {
      const { data } = await supabaseAdmin
        .from('report_generation_jobs')
        .insert({ user_id: userId, status: 'processing', provider: 'anthropic', attempt_count: 1 })
        .select('id')
        .single()
      currentJobId = data?.id
    } catch { /* job tracking is non-critical */ }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  let jobFinalized = false

  const finalizeJob = async (
    status: 'completed' | 'failed',
    extra: Record<string, unknown> = {}
  ): Promise<void> => {
    if (jobFinalized) return
    jobFinalized = true
    if (!currentJobId) return
    try {
      const ts = new Date().toISOString()
      await supabaseAdmin
        .from('report_generation_jobs')
        .update({
          status,
          ...(status === 'completed' ? { completed_at: ts } : { failed_at: ts }),
          ...extra,
        })
        .eq('id', currentJobId)
    } catch { /* finalize failure is non-critical */ }
  }

  // ── Retry-aware Anthropic stream ─────────────────────────────────────────────
  const MAX_ATTEMPTS = 3
  const RETRY_DELAYS = [0, 2000, 8000]  // ms: immediate, 2 s, 8 s
  const maxTokens    = isPro ? 16000 : 2048
  const maxSearches  = isPro ? 8 : 3

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'searching' })}\n\n`))

      let lastError: unknown
      let attemptCount = 0

      try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          attemptCount = attempt + 1

          if (attempt > 0) {
            await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'retrying' })}\n\n`))
            console.log(`[generate-report] Retry attempt ${attemptCount} for user ${userId}`)
          }

          try {
            const anthropicStream = await client.messages.stream({
              model:      'claude-sonnet-4-6',
              max_tokens: maxTokens,
              tools:      [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: maxSearches }],
              system:     selectedSystemPrompt,
              messages:   [{ role: 'user' as const, content: prompt }],
            })
            for await (const chunk of anthropicStream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
              }
            }

            // ── Success ──────────────────────────────────────────────────────
            await finalizeJob('completed', { attempt_count: attemptCount })
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
            controller.close()
            return

          } catch (error) {
            lastError = error
            const classified = classifyError(error)

            console.error(
              `[generate-report] Attempt ${attemptCount}/${MAX_ATTEMPTS} failed`,
              `code=${classified.code} user=${userId}`,
              classified.rawMessage.slice(0, 200)
            )

            // Non-retryable (billing, auth) — mark failed immediately, no retry
            if (!classified.retryable) {
              if (classified.shouldAlert) {
                void sendAdminAlert({ code: classified.code, rawError: classified.rawMessage, userId, businessName, attemptCount })
              }
              await finalizeJob('failed', {
                attempt_count:      attemptCount,
                error_code:         classified.code,
                sanitized_error:    classified.userMessage,
                raw_error_internal: classified.rawMessage.slice(0, 1000),
              })
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: classified.userMessage, errorCode: classified.code })}\n\n`))
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
              controller.close()
              return
            }
            // Retryable — loop continues
          }
        }

        // ── All retries exhausted ─────────────────────────────────────────────
        const classified = classifyError(lastError)
        void sendAdminAlert({ code: classified.code, rawError: classified.rawMessage, userId, businessName, attemptCount })
        await finalizeJob('failed', {
          attempt_count:      attemptCount,
          error_code:         classified.code,
          sanitized_error:    classified.userMessage,
          raw_error_internal: classified.rawMessage.slice(0, 1000),
        })
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: classified.userMessage, errorCode: classified.code })}\n\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()

      } finally {
        // ── Safety net: ensure no job is ever left in processing ─────────────
        // finalizeJob() is idempotent — if already finalized this is a no-op
        await finalizeJob('failed', {
          error_code:      'STALE_JOB_TIMEOUT',
          sanitized_error: 'Job ended without explicit completion.',
        })
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
