import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  // Protect billing routes
  if (nextUrl.pathname.startsWith('/api/billing') && !isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Protect subscription routes
  if (nextUrl.pathname.startsWith('/api/subscription') && !isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Protect usage routes
  if (nextUrl.pathname.startsWith('/api/usage') && !isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Allow webhook to be public (it has its own auth via signature)
  if (nextUrl.pathname.startsWith('/api/webhooks')) {
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
