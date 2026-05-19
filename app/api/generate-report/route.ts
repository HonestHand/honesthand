import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildReportPrompt } from '../../lib/claude'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const profile = await request.json()

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const isPro = profile.is_pro === true || profile.is_pro === 'true'

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
    isPro,
  }

  console.log('[generate-report] businessData:', JSON.stringify(businessData, null, 2))

  const prompt = buildReportPrompt(businessData)
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

REQUIRED SECTIONS (cover all 8, hit 25+ total opportunities):
1. Federal Grants & SBA Programs (5–7 opportunities)
2. Texas State Programs (4–6 opportunities)
3. Local / City / County Programs (3–5 opportunities based on their specific city)
4. Tax Credits & Deductions — federal and Texas (4–5 opportunities)
5. Certification Pathways — WOSB, HUBZone, 8(a), SB, veteran, minority certifications (3–4)
6. Government Contracting Opportunities — set-asides, SAM.gov registration, SBIR/STTR if applicable (2–3)
7. Industry-Specific Programs — niche grants, trade associations, industry grants for their sector (3–4)
8. 30-Day Action Plan — 8 concrete steps ranked from easiest win to most effort. Include agency names, real phone numbers where known, and exact next actions.

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

TONE: Direct, plain-spoken, optimistic but honest. Like a trusted advisor who grew up in Texas.

FORMAT RULES:
- Use ## for section headers. The ## must be at the very start of the line with nothing before it.
- Use **bold** for program names and dollar amounts
- Use bullet points for eligibility requirements
- Every opportunity MUST include all four of these fields:
  • **Value:** estimated dollar value or range
  • **Deadline:** specific date (e.g. "Apply by: September 30, 2026"), or "Rolling — apply anytime" for open programs, or "Typically opens: [month] — verify at [agency]" if the exact date is uncertain. Never omit this field.
  • **Why you qualify:** one sentence on eligibility match
  • **Next step:** exact action to take with agency name or URL`

  const stream = new ReadableStream({
    async start(controller) {
      // Send heartbeat immediately so the client's fetch() resolves before web searches start
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'searching' })}\n\n`))
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: isPro ? 8000 : 2048,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: isPro ? 8 : 3 }],
          system: isPro ? proSystemPrompt : freeSystemPrompt,
          messages: [{ role: 'user', content: prompt }],
        })

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const data = JSON.stringify({ text: chunk.delta.text })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        )
        controller.close()
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
