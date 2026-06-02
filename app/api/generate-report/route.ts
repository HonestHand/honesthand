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

  const proSystemPrompt = `You are a funding research engine. You return ONLY a valid JSON array. No prose. No explanation. No markdown. No preamble. No text before or after the JSON. Your entire response must be parseable by JSON.parse(). Every element in the array must follow this exact schema: id as a unique string, title as a string, category as a string, program_type as a string, tags as an array of strings, funding_snapshot as an object containing amount as a string and funding_type as a string, deadline as an object containing type as one of fixed or rolling or ongoing or seasonal, headline as a string containing date or status only and never any other content, supporting_text as a string, and urgency as one of high or medium or low, why_you_qualify as an array of short strings, next_step as a single concise actionable sentence string, qualification_detail as a string that explains why they qualify and never repeats next_step or deadline, official_url as a string, and official_source_name as a string.

The following rules are strict and violations will cause the output to be rejected. The deadline headline must contain only timing information and must never include why_you_qualify or next_step or any explanation. The next_step must appear once and only in the next_step field and must never be repeated in qualification_detail. The why_you_qualify field must be an array of short strings and never a paragraph and never markdown. The qualification_detail must not repeat the deadline or next_step. No field may contain double asterisks or double dashes or double hashes or any markdown syntax. If a field has no data omit the field entirely and never include empty strings or null values. Tax credit opportunities must include explanation and qualification logic and actionable guidance inside qualification_detail. Each qualification_detail field must be a maximum of 2 sentences. Each next_step field must be a maximum of 1 sentence. Keep all string fields concise — the entire JSON response must fit within the output window.`

  const freeSystemPrompt = `You are HonestHand — a straight-talking financial partner for Texas small business owners.
The current date is ${currentDate}. Always use accurate, current deadlines. Never reference past years or outdated program cycles.
Your job is to find real grants, tax credits, and government incentives they actually qualify for.

Generate a preview report with the top 3 sections only: Federal Programs, Texas State Programs, and Tax Credits.
Include 2–3 opportunities per section. Make each one count — real programs, accurate values, honest eligibility.

USE YOUR WEB SEARCH TOOL to confirm each program is currently active and open as of ${currentDate} before including it.

CRITICAL URL RULES — NON-NEGOTIABLE:
- Only link to these verified root domains: sba.gov, grants.gov, sam.gov, irs.gov, twc.texas.gov, gov.texas.gov, tvc.texas.gov, rd.usda.gov, texaswideopenforbusiness.com, treasury.gov, dol.gov, energy.gov
- If you are not 100% certain a specific URL path is correct, write only the root domain (e.g. "sba.gov" or "irs.gov") — never a made-up path. The root domain is always safe and becomes a direct clickable link for the customer
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
Return your response as a valid JSON array only with no text before or after the array and no markdown and no explanation and the first character of your response must be an opening bracket and the last character must be a closing bracket.`

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
- If you are not 100% certain a specific URL path is correct, write only the root domain (e.g. "grants.gov" or "hhs.gov") — never a made-up path. The root domain becomes a direct clickable link
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
Return your response as a valid JSON array only with no text before or after the array and no markdown and no explanation and the first character of your response must be an opening bracket and the last character must be a closing bracket.`

  const nonprofitFreeSystemPrompt = `You are HonestHand — a straight-talking funding partner for Texas nonprofits and community organizations.
The current date is ${currentDate}. Always use accurate, current deadlines and grant cycles.

Generate a preview nonprofit funding report with the top 3 sections only: Foundation Grants, Government Grants, and Capacity Building.
Include 2–3 opportunities per section. Make each one count — real programs, accurate grant amounts, honest eligibility.

USE YOUR WEB SEARCH TOOL to confirm each program is currently active and accepting applications or LOIs as of ${currentDate} before including it.

CRITICAL URL RULES — NON-NEGOTIABLE:
- Only link to these verified root domains: grants.gov, sam.gov, hhs.gov, arts.gov, hhs.texas.gov, gov.texas.gov
- For foundations, only link to root domains you are 100% certain exist
- If you are not 100% certain a specific URL path is correct, write only the root domain (e.g. "grants.gov" or "hhs.gov") — never a made-up path. The root domain is always safe and becomes a direct clickable link
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
Return your response as a valid JSON array only with no text before or after the array and no markdown and no explanation and the first character of your response must be an opening bracket and the last character must be a closing bracket.`

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

  // ─────────────────────────────────────────────────────────────────────────────
  // ⚠️  TEST-ONLY: Forced failure simulation
  //
  // TODO: This block must NEVER be committed with FORCE_REPORT_FAILURE=true in
  //       production env vars. It is a local/preview-only testing aid.
  //
  // Activate by setting in .env.local (local) or a Vercel preview environment:
  //   FORCE_REPORT_FAILURE=true
  //
  // Safety: The flag is ignored when VERCEL_ENV=production or NODE_ENV=production.
  // ─────────────────────────────────────────────────────────────────────────────
  const FORCE_FAILURE_ENABLED =
    process.env.FORCE_REPORT_FAILURE === 'true' &&
    process.env.VERCEL_ENV    !== 'production'  &&
    process.env.NODE_ENV      !== 'production'

  if (FORCE_FAILURE_ENABLED) {
    // Log prominently so it's impossible to miss in server logs
    console.warn(
      '\n⚠️  [TEST MODE] ─────────────────────────────────────────────────────────\n' +
      '   FORCE_REPORT_FAILURE=true — intentional failure simulation is ACTIVE.\n' +
      '   All report generation will fail. Disable before deploying to production.\n' +
      '─────────────────────────────────────────────────────────────────────────────\n'
    )
  }

  // ── Retry-aware Anthropic stream ─────────────────────────────────────────────
  const MAX_ATTEMPTS = 3
  const RETRY_DELAYS = [0, 2000, 8000]  // ms: immediate, 2 s, 8 s
  const maxTokens    = isPro ? 32000 : 2048
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
            // ── TEST-ONLY: Throw a retryable overload error if flag is set ──
            // Goes through the same classifyError → retry → finalize path as a
            // real provider failure. No billing alerts. No special casing.
            // TODO: Remove this block when the testing system is no longer needed.
            if (FORCE_FAILURE_ENABLED) {
              console.warn(`[TEST MODE] Simulating PROVIDER_OVERLOAD on attempt ${attemptCount}/${MAX_ATTEMPTS}`)
              throw new Error(`Service overloaded — test simulation (attempt ${attemptCount})`)
            }

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

