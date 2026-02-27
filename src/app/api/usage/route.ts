import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getOrCreateUsage, getUserWithSubscription } from '@/lib/usage'
import { PLANS } from '@/lib/stripe'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user ID from email
    const user = await getUserWithSubscription(session.user.email)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const usage = await getOrCreateUsage(user.id)
    const plan = user.subscription?.plan || 'FREE'
    const planConfig = PLANS[plan as keyof typeof PLANS]

    return NextResponse.json({
      usage: {
        gscRequestsToday: usage.gscRequestsToday,
        indexNowRequestsToday: usage.indexNowRequestsToday,
        urlsIndexedToday: usage.urlsIndexedToday,
        gscRequestsThisMonth: usage.gscRequestsThisMonth,
        urlsIndexedThisMonth: usage.urlsIndexedThisMonth,
        totalUrlsIndexed: usage.totalUrlsIndexed,
        totalGscRequests: usage.totalGscRequests,
      },
      limits: planConfig.features,
      plan,
    })
  } catch (error: any) {
    console.error('Get usage error:', error)
    return NextResponse.json(
      { error: 'Failed to get usage' },
      { status: 500 }
    )
  }
}
