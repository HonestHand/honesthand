import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let email: string
  try {
    const body = await request.json()
    email = body.email
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  console.log('[verify-payment] Looking up Stripe customer for email:', email)

  // Find customers matching this email
  const customers = await stripe.customers.list({ email, limit: 5 })
  console.log('[verify-payment] Customers found:', customers.data.length)

  if (customers.data.length === 0) {
    return NextResponse.json({ error: 'No Stripe customer found for this email' }, { status: 404 })
  }

  // Check each customer for an active subscription
  let activeCustomerId: string | null = null
  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    })
    console.log('[verify-payment] Customer', customer.id, 'active subscriptions:', subscriptions.data.length)
    if (subscriptions.data.length > 0) {
      activeCustomerId = customer.id
      break
    }
  }

  if (!activeCustomerId) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 402 })
  }

  console.log('[verify-payment] Active customer ID:', activeCustomerId)

  // Look up the Supabase user by email to get their id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    console.error('[verify-payment] Profile lookup failed:', profileError?.message)
    return NextResponse.json({ error: 'Profile not found for this email' }, { status: 404 })
  }

  console.log('[verify-payment] Updating profile id:', profile.id)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      is_pro: true,
      stripe_customer_id: activeCustomerId,
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error('[verify-payment] Supabase update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
