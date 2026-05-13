import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // TODO: re-enable signature verification before going live
  // const body = await request.text()
  // const signature = request.headers.get('stripe-signature')!
  // try {
  //   event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  // } catch (error) {
  //   return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  // }
  let event
  try {
    event = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.userId

    if (userId) {
      await supabase
        .from('profiles')
        .update({ 
          is_pro: true,
          stripe_customer_id: session.customer as string
        })
        .eq('id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    await supabase
      .from('profiles')
      .update({ is_pro: false })
      .eq('stripe_customer_id', subscription.customer as string)
  }

  return NextResponse.json({ received: true })
}