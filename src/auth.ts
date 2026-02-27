import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/indexing",
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code",
                },
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (!user.email) return false

            try {
                // Create or update user in database
                const dbUser = await prisma.user.upsert({
                    where: { email: user.email },
                    create: {
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        googleId: account?.providerAccountId,
                    },
                    update: {
                        name: user.name,
                        image: user.image,
                        googleId: account?.providerAccountId,
                    },
                })

                // Create default usage record if not exists
                await prisma.usage.upsert({
                    where: { userId: dbUser.id },
                    create: { userId: dbUser.id },
                    update: {},
                })

                // Create default subscription if not exists
                await prisma.subscription.upsert({
                    where: { userId: dbUser.id },
                    create: {
                        userId: dbUser.id,
                        plan: 'FREE',
                        status: 'INACTIVE',
                    },
                    update: {},
                })

                return true
            } catch (error) {
                console.error('Error creating/updating user:', error)
                return true // Still allow sign in even if DB fails
            }
        },
        async jwt({ token, account, user }) {
            // Persist the OAuth access_token and refresh_token to the token right after signin
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token
            }
            
            // Add user ID from database
            if (user?.email) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { email: user.email },
                        include: { subscription: true },
                    })
                    if (dbUser) {
                        token.userId = dbUser.id
                        token.plan = dbUser.subscription?.plan || 'FREE'
                        token.subscriptionStatus = dbUser.subscription?.status || 'INACTIVE'
                    }
                } catch (error) {
                    console.error('Error fetching user for JWT:', error)
                }
            }
            
            return token
        },
        async session({ session, token }: any) {
            // Send properties to the client, like an access_token from a provider.
            session.accessToken = token.accessToken
            session.user.id = token.userId
            session.user.plan = token.plan || 'FREE'
            session.user.subscriptionStatus = token.subscriptionStatus || 'INACTIVE'
            return session
        },
    },
    pages: {
        signIn: '/',
    },
})
