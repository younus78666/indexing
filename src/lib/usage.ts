import { prisma } from './prisma'
import { PLANS, PlanType } from './stripe'

export async function getUserWithSubscription(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      usage: true,
    },
  })
  return user
}

export async function getOrCreateUsage(userId: string) {
  let usage = await prisma.usage.findUnique({
    where: { userId },
  })

  if (!usage) {
    usage = await prisma.usage.create({
      data: { userId },
    })
  }

  // Check if we need to reset daily counters
  const now = new Date()
  const lastReset = new Date(usage.lastResetDate)
  const isNewDay = now.getDate() !== lastReset.getDate() || 
                   now.getMonth() !== lastReset.getMonth() || 
                   now.getFullYear() !== lastReset.getFullYear()

  if (isNewDay) {
    usage = await prisma.usage.update({
      where: { userId },
      data: {
        gscRequestsToday: 0,
        indexNowRequestsToday: 0,
        urlsIndexedToday: 0,
        lastResetDate: now,
      },
    })
  }

  // Check if we need to reset monthly counters
  const lastMonthlyReset = new Date(usage.lastMonthlyReset)
  const isNewMonth = now.getMonth() !== lastMonthlyReset.getMonth() || 
                     now.getFullYear() !== lastMonthlyReset.getFullYear()

  if (isNewMonth) {
    usage = await prisma.usage.update({
      where: { userId },
      data: {
        gscRequestsThisMonth: 0,
        urlsIndexedThisMonth: 0,
        lastMonthlyReset: now,
      },
    })
  }

  return usage
}

export async function checkUsageLimit(
  userId: string, 
  type: 'gsc' | 'indexnow' | 'bulk_gsc' | 'bulk_indexnow',
  count: number = 1
): Promise<{ allowed: boolean; limit: number; current: number; message?: string }> {
  const user = await getUserWithSubscription(userId)
  
  if (!user) {
    return { allowed: false, limit: 0, current: 0, message: 'User not found' }
  }

  const plan = (user.subscription?.plan || 'FREE') as PlanType
  const planConfig = PLANS[plan]
  const usage = await getOrCreateUsage(userId)

  // Check if subscription is active for paid plans
  if (plan !== 'FREE' && user.subscription?.status !== 'ACTIVE' && user.subscription?.status !== 'TRIALING') {
    return { 
      allowed: false, 
      limit: 0, 
      current: 0, 
      message: 'Your subscription is not active. Please update your payment method.' 
    }
  }

  let limit = 0
  let current = 0

  switch (type) {
    case 'gsc':
      limit = planConfig.features.gscRequestsPerDay
      current = usage.gscRequestsToday
      break
    case 'indexnow':
      limit = planConfig.features.indexNowRequestsPerDay
      current = usage.indexNowRequestsToday
      break
    case 'bulk_gsc':
      if (!planConfig.features.bulkIndexing) {
        return { allowed: false, limit: 0, current: 0, message: 'Bulk indexing requires a paid plan' }
      }
      limit = planConfig.features.gscRequestsPerDay
      current = usage.gscRequestsToday
      break
    case 'bulk_indexnow':
      if (!planConfig.features.bulkIndexing) {
        return { allowed: false, limit: 0, current: 0, message: 'Bulk indexing requires a paid plan' }
      }
      limit = planConfig.features.indexNowRequestsPerDay
      current = usage.indexNowRequestsToday
      break
  }

  // Free plan is always allowed but limited
  if (plan === 'FREE') {
    if (current + count > limit) {
      return { 
        allowed: false, 
        limit, 
        current, 
        message: `Free plan limit: ${limit} requests per day. Upgrade for more.` 
      }
    }
  }

  if (current + count > limit) {
    return { 
      allowed: false, 
      limit, 
      current, 
      message: `Daily limit reached (${limit}/${limit}). Resets tomorrow.` 
    }
  }

  return { allowed: true, limit, current }
}

export async function incrementUsage(
  userId: string, 
  type: 'gsc' | 'indexnow',
  count: number = 1
) {
  const usage = await getOrCreateUsage(userId)

  const updateData: any = {}
  
  if (type === 'gsc') {
    updateData.gscRequestsToday = usage.gscRequestsToday + count
    updateData.gscRequestsThisMonth = usage.gscRequestsThisMonth + count
    updateData.totalGscRequests = usage.totalGscRequests + count
    updateData.urlsIndexedToday = usage.urlsIndexedToday + count
    updateData.urlsIndexedThisMonth = usage.urlsIndexedThisMonth + count
    updateData.totalUrlsIndexed = usage.totalUrlsIndexed + count
  } else {
    updateData.indexNowRequestsToday = usage.indexNowRequestsToday + count
    updateData.urlsIndexedToday = usage.urlsIndexedToday + count
    updateData.totalUrlsIndexed = usage.totalUrlsIndexed + count
  }

  return prisma.usage.update({
    where: { userId },
    data: updateData,
  })
}

export async function logIndexingAttempt(
  userId: string,
  url: string,
  type: 'GSC' | 'INDEXNOW' | 'BULK_GSC' | 'BULK_INDEXNOW',
  status: 'success' | 'error' | 'pending',
  message?: string
) {
  return prisma.indexingLog.create({
    data: {
      userId,
      url,
      type,
      status,
      message,
    },
  })
}
