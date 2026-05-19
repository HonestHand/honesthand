import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { email, userId } = await request.json()
  if (!email || !userId) {
    return NextResponse.json({ error: 'Missing email or userId' }, { status: 400 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  try {
    const customers = await stripe.customers.list({ email, limit: 1 })
    if (customers.data.length === 0) {
      return NextResponse.json({ is_pro: false })
    }

    const customerId = customers.data[0].id
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ is_pro: false })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_pro: true, stripe_customer_id: customerId })
      .eq('id', userId)
      .select('id, is_pro')

    if (updateError) {
      console.error('[activate-pro] Supabase update error:', updateError)
      return NextResponse.json({ error: 'DB update failed: ' + updateError.message }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      // Profile row not found by userId — try to set it anyway via upsert
      console.error('[activate-pro] No rows matched userId:', userId, '— attempting upsert')
      const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: userId, is_pro: true, stripe_customer_id: customerId }, { onConflict: 'id' })
      if (upsertError) {
        console.error('[activate-pro] Upsert also failed:', upsertError)
        return NextResponse.json({ error: 'Could not set pro status' }, { status: 500 })
      }
    }

    return NextResponse.json({ is_pro: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
