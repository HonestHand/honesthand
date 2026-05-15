import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  try {
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId: string | null = profileData?.stripe_customer_id ?? null

    if (!customerId && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 })
      if (customers.data.length > 0) {
        customerId = customers.data[0].id
      }
    }

    if (!customerId) {
      return NextResponse.json({ is_pro: false })
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length > 0) {
      await supabaseAdmin
        .from('profiles')
        .update({ is_pro: true, stripe_customer_id: customerId })
        .eq('id', user.id)
      return NextResponse.json({ is_pro: true })
    }

    return NextResponse.json({ is_pro: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
