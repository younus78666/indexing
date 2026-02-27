import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: Request) {
  try {
    const payload = await request.text()
    const signature = (await headers()).get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const userId = session.metadata?.userId
        
        if (!userId) {
          console.error('No userId in session metadata')
          break
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        
        // Determine plan from price ID
        const priceId = subscription.items.data[0].price.id
        let plan = 'STARTER'
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = 'PRO'
        if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) plan = 'AGENCY'

        // Update subscription in database
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            plan: plan as any,
            status: 'ACTIVE',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
          update: {
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            plan: plan as any,
            status: 'ACTIVE',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any
        const subscriptionId = invoice.subscription
        
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: {
              status: 'ACTIVE',
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription },
          data: { status: 'PAST_DUE' },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { 
            status: 'CANCELED',
            plan: 'FREE',
          },
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        
        let plan = 'STARTER'
        const priceId = subscription.items.data[0].price.id
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = 'PRO'
        if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) plan = 'AGENCY'

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan: plan as any,
            stripePriceId: priceId,
            status: subscription.status === 'active' ? 'ACTIVE' : subscription.status.toUpperCase(),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        })
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
