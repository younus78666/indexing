'use client';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Check, X, Zap, Shield, Building2, User } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const plans = [
  {
    name: 'Free',
    price: 0,
    description: 'Perfect for trying out',
    icon: User,
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
  {
    name: 'Starter',
    price: 9,
    description: 'For small websites',
    icon: Zap,
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
    popular: true,
    features: {
      gscRequestsPerDay: 100,
      indexNowRequestsPerDay: 500,
      urlsPerBatch: 100,
      sites: 3,
      bulkIndexing: true,
      prioritySupport: false,
    },
  },
  {
    name: 'Pro',
    price: 29,
    description: 'For growing businesses',
    icon: Shield,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    features: {
      gscRequestsPerDay: 500,
      indexNowRequestsPerDay: 2000,
      urlsPerBatch: 500,
      sites: 10,
      bulkIndexing: true,
      prioritySupport: true,
    },
  },
  {
    name: 'Agency',
    price: 99,
    description: 'For SEO agencies',
    icon: Building2,
    priceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID,
    features: {
      gscRequestsPerDay: 2000,
      indexNowRequestsPerDay: 10000,
      urlsPerBatch: 2000,
      sites: 50,
      bulkIndexing: true,
      prioritySupport: true,
    },
  },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string | null, planName: string) => {
    if (!session) {
      signIn('google');
      return;
    }

    if (!priceId) {
      // Free plan - just redirect to dashboard
      window.location.href = '/dashboard';
      return;
    }

    setIsLoading(planName);

    try {
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const formatNumber = (num: number) => {
    return num >= 1000 ? `${(num / 1000).toFixed(0)}k` : num;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-xl text-white">IndexPro</span>
          </a>
          <nav className="flex items-center gap-6">
            <a href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</a>
            {session ? (
              <a href="/dashboard" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                Go to Dashboard
              </a>
            ) : (
              <button onClick={() => signIn('google')} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                Sign In
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-white mb-6">
          Simple, transparent pricing
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Choose the perfect plan for your indexing needs. Upgrade or downgrade at any time.
        </p>
      </div>

      {/* Pricing Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = session?.user?.plan === plan.name.toUpperCase();
            
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.popular
                    ? 'border-indigo-500/50 bg-indigo-500/5'
                    : 'border-slate-800 bg-[#0a0a0a]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    plan.popular ? 'bg-indigo-500/20' : 'bg-slate-800'
                  }`}>
                    <Icon className={`w-5 h-5 ${plan.popular ? 'text-indigo-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-500">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-slate-500">/month</span>
                </div>

                <button
                  onClick={() => handleSubscribe(plan.priceId, plan.name)}
                  disabled={isLoading === plan.name || isCurrentPlan}
                  className={`w-full py-2.5 rounded-lg font-medium transition-colors mb-6 ${
                    isCurrentPlan
                      ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                      : plan.popular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  {isLoading === plan.name
                    ? 'Loading...'
                    : isCurrentPlan
                    ? 'Current Plan'
                    : plan.price === 0
                    ? 'Get Started Free'
                    : 'Subscribe'}
                </button>

                <div className="space-y-3 flex-1">
                  <Feature 
                    text={`${plan.features.gscRequestsPerDay} GSC requests/day`}
                    included={true}
                  />
                  <Feature 
                    text={`${formatNumber(plan.features.indexNowRequestsPerDay)} IndexNow requests/day`}
                    included={true}
                  />
                  <Feature 
                    text={`${plan.features.urlsPerBatch} URLs per batch`}
                    included={true}
                  />
                  <Feature 
                    text={`${plan.features.sites} site${plan.features.sites > 1 ? 's' : ''}`}
                    included={true}
                  />
                  <Feature 
                    text="Bulk indexing"
                    included={plan.features.bulkIndexing}
                  />
                  <Feature 
                    text="Priority support"
                    included={plan.features.prioritySupport}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <FAQ 
              question="What happens when I exceed my daily limit?"
              answer="Your limits reset every day at midnight UTC. If you reach your limit, you can upgrade to a higher plan for more requests or wait for the next day."
            />
            <FAQ 
              question="Can I change plans at any time?"
              answer="Yes! You can upgrade or downgrade your plan at any time. When you upgrade, you'll be charged prorated for the remainder of the billing period."
            />
            <FAQ 
              question="Do you offer refunds?"
              answer="We offer a 7-day money-back guarantee for all paid plans. If you're not satisfied, contact us within 7 days for a full refund."
            />
            <FAQ 
              question="Is my payment information secure?"
              answer="Yes, we use Stripe for payment processing. We never store your credit card information on our servers."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text, included }: { text: string; included: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {included ? (
        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <X className="w-4 h-4 text-slate-600 shrink-0" />
      )}
      <span className={included ? 'text-slate-300' : 'text-slate-600'}>{text}</span>
    </div>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-slate-800 pb-6">
      <h3 className="font-medium text-white mb-2">{question}</h3>
      <p className="text-slate-400">{answer}</p>
    </div>
  );
}
