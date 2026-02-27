import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

export const getOrCreateCustomer = async (userId: string, email: string, name?: string | null) => {
  const { prisma } = await import('./prisma')
  
  // Check if user already has a stripe customer
  let subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { user: true }
  })

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || email,
    metadata: {
      userId,
    },
  })

  // Create or update subscription record
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customer.id,
      plan: 'FREE',
      status: 'INACTIVE',
    },
    update: {
      stripeCustomerId: customer.id,
    },
  })

  return customer.id
}

export const PLANS = {
  FREE: {
    name: 'Free',
    description: 'For personal use',
    price: 0,
    priceId: null,
    features: {
      gscRequestsPerDay: 10,
      indexNowRequestsPerDay: 50,
      urlsPerBatch: 10,
      sites: 1,
      bulkIndexing: false,
      prioritySupport: false,
    },
  },
  STARTER: {
    name: 'Starter',
    description: 'For small websites',
    price: 9,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: {
      gscRequestsPerDay: 100,
      indexNowRequestsPerDay: 500,
      urlsPerBatch: 100,
      sites: 3,
      bulkIndexing: true,
      prioritySupport: false,
    },
  },
  PRO: {
    name: 'Pro',
    description: 'For growing businesses',
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: {
      gscRequestsPerDay: 500,
      indexNowRequestsPerDay: 2000,
      urlsPerBatch: 500,
      sites: 10,
      bulkIndexing: true,
      prioritySupport: true,
    },
  },
  AGENCY: {
    name: 'Agency',
    description: 'For SEO agencies',
    price: 99,
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
    features: {
      gscRequestsPerDay: 2000,
      indexNowRequestsPerDay: 10000,
      urlsPerBatch: 2000,
      sites: 50,
      bulkIndexing: true,
      prioritySupport: true,
    },
  },
}

export type PlanType = keyof typeof PLANS
