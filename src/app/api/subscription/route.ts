import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PLANS } from '@/lib/stripe'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with subscription and usage
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { 
        subscription: true,
        usage: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const plan = user.subscription?.plan || 'FREE'
    const planConfig = PLANS[plan as keyof typeof PLANS]

    return NextResponse.json({
      subscription: {
        plan: user.subscription?.plan || 'FREE',
        status: user.subscription?.status || 'INACTIVE',
        currentPeriodEnd: user.subscription?.currentPeriodEnd,
      },
      usage: user.usage || {
        gscRequestsToday: 0,
        indexNowRequestsToday: 0,
        urlsIndexedToday: 0,
        totalUrlsIndexed: 0,
      },
      limits: planConfig.features,
    })
  } catch (error: any) {
    console.error('Get subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    )
  }
}
