import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let sessionId: string
  try {
    const body = await request.json()
    sessionId = body.session_id
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[verify-payment] Failed to retrieve session:', message)
    return NextResponse.json({ error: `Failed to retrieve session: ${message}` }, { status: 400 })
  }

  console.log('[verify-payment] payment_status:', session.payment_status)
  console.log('[verify-payment] metadata:', session.metadata)

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment not completed', payment_status: session.payment_status }, { status: 402 })
  }

  const userId = session.metadata?.userId
  if (!userId) {
    console.error('[verify-payment] No userId in session metadata for session:', sessionId)
    return NextResponse.json({ error: 'No userId in session metadata' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_pro: true })
    .eq('id', userId)

  if (updateError) {
    console.error('[verify-payment] Supabase update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  console.log('[verify-payment] Successfully updated is_pro for userId:', userId)
  return NextResponse.json({ success: true })
}
