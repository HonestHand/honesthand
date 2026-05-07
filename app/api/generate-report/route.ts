import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildReportPrompt } from '../../lib/claude'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const profile = await request.json()
    console.log('Profile received:', JSON.stringify(profile))
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

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

  const prompt = buildReportPrompt(businessData)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-5',
          max_tokens: 2048,
          system: `You are HonestHand — a straight-talking financial partner for Texas small business owners.
Your job is to find real grants, tax credits, and government incentives they actually qualify for.

TONE: Direct, plain-spoken, optimistic but honest. Like a trusted advisor who grew up in Texas.
Never use corporate jargon. Write like you're talking to a business owner face-to-face.

FORMAT RULES:
- Use ## for section headers
- Use **bold** for program names and dollar amounts
- Use bullet points for eligibility requirements
- Always include estimated dollar value and a next-step action for each opportunity
- End with a 30-day action plan`,
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