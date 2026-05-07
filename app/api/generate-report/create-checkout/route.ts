import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const { userId, email } = await request.json()

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: 'price_1TUZlhGkAuVF20utMpyir8Xd',
          quantity: 1,
        },
      ],
      metadata: { userId },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?cancelled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}