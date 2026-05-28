import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { email, userId, sessionId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  try {
    if (sessionId) {
      // Preferred path: retrieve checkout session directly — no email ambiguity
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)
      if (checkoutSession.payment_status !== 'paid' && checkoutSession.status !== 'complete') {
        return NextResponse.json({ is_pro: false })
      }
    } else if (email) {
      // Fallback: search by email
      const customers = await stripe.customers.list({ email, limit: 1 })
      if (customers.data.length === 0) return NextResponse.json({ is_pro: false })
      const customer = customers.data[0]
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1,
      })
      if (subscriptions.data.length === 0) return NextResponse.json({ is_pro: false })
    } else {
      return NextResponse.json({ error: 'Missing email or sessionId' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_pro: true })
      .eq('id', userId)
      .select('id, is_pro')

    if (updateError) {
      console.error('[activate-pro] update error:', updateError)
      return NextResponse.json({ error: 'DB update failed: ' + updateError.message }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      console.error('[activate-pro] no rows matched userId:', userId, '— upserting')
      const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: userId, is_pro: true }, { onConflict: 'id' })
      if (upsertError) {
        console.error('[activate-pro] upsert failed:', upsertError)
        return NextResponse.json({ error: 'Could not set pro status' }, { status: 500 })
      }
    }

    return NextResponse.json({ is_pro: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[activate-pro] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
