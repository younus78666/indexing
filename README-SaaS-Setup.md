# IndexPro SaaS Setup Guide

This guide will help you set up the IndexPro application as a complete SaaS with Stripe payments, usage tracking, and subscription management.

## Features

- ✅ Google Search Console integration
- ✅ Stripe subscription payments
- ✅ Multiple pricing tiers (Free, Starter, Pro, Agency)
- ✅ Usage tracking and limits
- ✅ User authentication with NextAuth
- ✅ SQLite database with Prisma ORM
- ✅ Billing portal integration
- ✅ Webhook handling for Stripe events

## Prerequisites

- Node.js 18+
- Stripe account
- Google Cloud Console project (for OAuth)
- Omega Indexer API key (optional, for backlink indexing)

## Step 1: Install Dependencies

The following packages need to be installed:

```bash
cd app
npm install prisma @prisma/client stripe @stripe/stripe-js
```

## Step 2: Set Up Environment Variables

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Fill in all the required environment variables (see below).

### Required Environment Variables

#### Database
- `DATABASE_URL`: SQLite database file path (default: `file:./dev.db`)

#### NextAuth
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET`: Random secret key (generate with `openssl rand -base64 32`)

#### Google OAuth
- `GOOGLE_CLIENT_ID`: From Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: From Google Cloud Console

#### Stripe
- `STRIPE_SECRET_KEY`: From Stripe Dashboard
- `STRIPE_PUBLISHABLE_KEY`: From Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET`: From Stripe CLI or Dashboard

#### Stripe Price IDs
Create products and prices in Stripe Dashboard, then add the Price IDs:
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_AGENCY_PRICE_ID`

## Step 3: Set Up Stripe Products

1. Go to Stripe Dashboard → Products
2. Create 3 products:
   - Starter ($9/month)
   - Pro ($29/month)
   - Agency ($99/month)

3. For each product, create a recurring price
4. Copy the Price IDs to your `.env.local` file

## Step 4: Set Up Stripe Webhook

### Local Development

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli

2. Login to Stripe:
```bash
stripe login
```

3. Start webhook forwarding:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

4. Copy the webhook signing secret to `.env.local`

### Production

1. In Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`

## Step 5: Initialize Database

1. Generate Prisma client:
```bash
npx prisma generate
```

2. Run migrations:
```bash
npx prisma migrate dev --name init
```

3. (Optional) Open Prisma Studio to view data:
```bash
npx prisma studio
```

## Step 6: Set Up Google OAuth

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable APIs:
   - Google Search Console API
   - Indexing API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

## Step 7: Run the Application

```bash
npm run dev
```

## Pricing Tiers

| Feature | Free | Starter ($9) | Pro ($29) | Agency ($99) |
|---------|------|--------------|-----------|--------------|
| GSC Requests/Day | 10 | 100 | 500 | 2000 |
| IndexNow Requests/Day | 50 | 500 | 2000 | 10000 |
| URLs per Batch | 10 | 100 | 500 | 2000 |
| Sites | 1 | 3 | 10 | 50 |
| Bulk Indexing | ❌ | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ | ✅ |

## API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication

### Billing
- `POST /api/billing/create-checkout` - Create Stripe checkout session
- `POST /api/billing/create-portal` - Create billing portal session

### Subscription
- `GET /api/subscription` - Get current subscription info

### Usage
- `GET /api/usage` - Get usage statistics

### GSC
- `GET /api/gsc/sites` - List GSC properties (limited by plan)
- `GET /api/gsc/urls` - Get URLs from sitemap
- `POST /api/gsc` - Submit URL for indexing (with usage tracking)
- `POST /api/gsc/inspect` - Inspect URL index status

### IndexNow
- `POST /api/indexnow` - Submit URLs to IndexNow (with usage tracking)

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

## Database Schema

### User
- id, email, name, image, googleId, createdAt, updatedAt

### Subscription
- id, userId, stripeCustomerId, stripeSubscriptionId, stripePriceId
- plan, status, currentPeriodStart, currentPeriodEnd

### Usage
- Daily and monthly counters for GSC and IndexNow requests
- Tracks total URLs indexed

### UserSite
- Tracks sites the user has accessed

### IndexingLog
- Audit log of all indexing attempts

## Pages

- `/` - Main dashboard (GSC indexer)
- `/pricing` - Pricing plans and checkout
- `/dashboard` - User dashboard with usage stats and subscription management

## Troubleshooting

### Stripe webhook not working locally
Make sure Stripe CLI is running and forwarding to the correct port.

### Database errors
Run `npx prisma migrate dev` to apply pending migrations.

### Google OAuth errors
Check that redirect URIs match exactly in Google Cloud Console.

### Usage limits not resetting
Daily limits reset at midnight UTC. Check server time if issues persist.

## Deployment

### Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Add all environment variables in Vercel Dashboard
4. For Stripe webhooks, use the production webhook URL

### Other Platforms

Ensure your hosting platform supports:
- Node.js 18+
- SQLite or migrate to PostgreSQL
- Environment variables
- WebSocket support for hot reloading (dev only)

## Security Considerations

1. Always use HTTPS in production
2. Keep webhook secrets secure
3. Regularly rotate API keys
4. Enable Stripe's fraud detection
5. Monitor usage for abuse

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Stripe/NextAuth/Prisma documentation
3. Open an issue on the repository
