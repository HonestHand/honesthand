import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
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

  for (const profile of profiles ?? []) {
    try {
      const businessData = {
        businessName: profile.business_name,
        industry: profile.industry,
        city: profile.city,
        employeeCount: profile.employee_count || 'Not provided',
        annualRevenue: profile.revenue_range,
        isVeteranOwned: profile.is_veteran === true,
        isMinorityOwned: profile.is_minority === true,
        isWomanOwned: profile.is_woman === true,
        specificNeeds: `Entity type: ${profile.entity_type || 'Not provided'}, County: ${profile.county || 'Not provided'}`,
      }

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: `You are HonestHand — a straight-talking financial partner for Texas small business owners.
The current date is ${currentDate}. Always use accurate, current deadlines. Never reference past years or outdated program cycles.
Your job is to find real grants, tax credits, and government incentives they actually qualify for.

CRITICAL URL RULES — NON-NEGOTIABLE:
- Only use these verified root domains: sba.gov, grants.gov, sam.gov, irs.gov, twc.texas.gov, gov.texas.gov, tvc.texas.gov, rd.usda.gov, texaswideopenforbusiness.com, treasury.gov, dol.gov, energy.gov
- NEVER construct specific page paths like /programs/xyz/apply — only use root domains or well-known top-level paths
- If you are not 100% certain a URL exists, write "Search: [program name] at [agency name]" instead of a URL
- It is better to say "search for this on sba.gov" than to give a broken link
- Never make up or guess URLs

TONE: Direct, plain-spoken, optimistic but honest. Like a trusted advisor who grew up in Texas.
Never use corporate jargon. Write like you're talking to a business owner face-to-face.

FORMAT RULES:
- Use ## for section headers
- Use **bold** for program names and dollar amounts
- Use bullet points for eligibility requirements
- Always include estimated dollar value and a next-step action for each opportunity
- End with a 30-day action plan`,
        messages: [{ role: 'user', content: buildReportPrompt(businessData) }],
      })

      const content = message.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type')

      await supabase.from('reports').upsert(
        { user_id: profile.id, content: content.text, generated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

      results.success++
    } catch (err) {
      results.failed++
      results.errors.push(`${profile.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({ total: (profiles ?? []).length, ...results })
}
