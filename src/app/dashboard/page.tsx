'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { 
  Activity, LogOut, BarChart3, Zap, Globe, 
  CheckCircle2, AlertCircle, ArrowRight, CreditCard,
  TrendingUp, Calendar, RefreshCw
} from 'lucide-react';

interface UsageData {
  usage: {
    gscRequestsToday: number;
    indexNowRequestsToday: number;
    urlsIndexedToday: number;
    gscRequestsThisMonth: number;
    urlsIndexedThisMonth: number;
    totalUrlsIndexed: number;
    totalGscRequests: number;
  };
  limits: {
    gscRequestsPerDay: number;
    indexNowRequestsPerDay: number;
    urlsPerBatch: number;
    sites: number;
    bulkIndexing: boolean;
    prioritySupport: boolean;
  };
  plan: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUsage();
    }
  }, [status]);

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (e) {
      console.error('Failed to fetch usage:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/create-portal', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('Failed to create portal:', e);
    } finally {
      setPortalLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Please sign in</h1>
          <button
            onClick={() => signIn('google')}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const planColors: Record<string, string> = {
    FREE: 'bg-slate-500/20 text-slate-400',
    STARTER: 'bg-emerald-500/20 text-emerald-400',
    PRO: 'bg-indigo-500/20 text-indigo-400',
    AGENCY: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-xl text-white">IndexPro</span>
            </a>
            <nav className="hidden md:flex items-center gap-6">
              <a href="/dashboard" className="text-white font-medium">Dashboard</a>
              <a href="/" className="text-slate-400 hover:text-white transition-colors">GSC Indexer</a>
              <a href="/pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {session?.user && (
              <>
                <div className="hidden md:flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${planColors[usage?.plan || 'FREE']}`}>
                    {usage?.plan || 'FREE'}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-medium text-white">
                    {session.user.name?.[0] || session.user.email?.[0]}
                  </div>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-slate-400">
            Here's your indexing activity and subscription overview.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard
            title="URLs Indexed Today"
            value={usage?.usage.urlsIndexedToday || 0}
            limit={usage?.limits.gscRequestsPerDay}
            icon={Globe}
            color="indigo"
          />
          <StatCard
            title="GSC Requests"
            value={usage?.usage.gscRequestsToday || 0}
            limit={usage?.limits.gscRequestsPerDay}
            icon={Activity}
            color="emerald"
          />
          <StatCard
            title="IndexNow Requests"
            value={usage?.usage.indexNowRequestsToday || 0}
            limit={usage?.limits.indexNowRequestsPerDay}
            icon={Zap}
            color="amber"
          />
          <StatCard
            title="Total URLs Indexed"
            value={usage?.usage.totalUrlsIndexed || 0}
            icon={TrendingUp}
            color="purple"
            showLimit={false}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subscription Card */}
          <div className="lg:col-span-2 bg-[#0a0a0a] border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Subscription</h2>
                  <p className="text-sm text-slate-500">Manage your plan and billing</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${planColors[usage?.plan || 'FREE']}`}>
                {usage?.plan || 'FREE'} Plan
              </span>
            </div>

            <div className="space-y-4 mb-6">
              <PlanFeature 
                icon={Globe}
                label="Daily GSC Requests"
                value={`${usage?.limits.gscRequestsPerDay}`}
                used={usage?.usage.gscRequestsToday}
              />
              <PlanFeature 
                icon={Zap}
                label="Daily IndexNow Requests"
                value={`${usage?.limits.indexNowRequestsPerDay}`}
                used={usage?.usage.indexNowRequestsToday}
              />
              <PlanFeature 
                icon={BarChart3}
                label="URLs per Batch"
                value={`${usage?.limits.urlsPerBatch}`}
              />
              <PlanFeature 
                icon={CheckCircle2}
                label="Sites"
                value={`${usage?.limits.sites}`}
              />
              <PlanFeature 
                icon={CheckCircle2}
                label="Bulk Indexing"
                value={usage?.limits.bulkIndexing ? 'Yes' : 'No'}
                status={usage?.limits.bulkIndexing ? 'success' : 'neutral'}
              />
              <PlanFeature 
                icon={CheckCircle2}
                label="Priority Support"
                value={usage?.limits.prioritySupport ? 'Yes' : 'No'}
                status={usage?.limits.prioritySupport ? 'success' : 'neutral'}
              />
            </div>

            <div className="flex gap-3">
              <a
                href="/pricing"
                className="flex-1 py-2.5 text-center rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors font-medium"
              >
                Change Plan
              </a>
              {usage?.plan !== 'FREE' && (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium disabled:opacity-50"
                >
                  {portalLoading ? 'Loading...' : 'Manage Billing'}
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#0a0a0a] border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-6">Quick Actions</h2>
            
            <div className="space-y-3">
              <QuickAction
                href="/"
                icon={Globe}
                title="GSC Indexer"
                description="Index your Google Search Console URLs"
              />
              <QuickAction
                href="/?tab=indexnow"
                icon={Zap}
                title="Fast Indexer"
                description="Submit URLs via IndexNow"
              />
              <QuickAction
                href="/pricing"
                icon={CreditCard}
                title="Upgrade Plan"
                description="Get more indexing power"
              />
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Calendar className="w-4 h-4" />
                <span>Limits reset daily at midnight UTC</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  limit, 
  icon: Icon, 
  color,
  showLimit = true 
}: { 
  title: string; 
  value: number; 
  limit?: number; 
  icon: any; 
  color: string;
  showLimit?: boolean;
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  const percentage = limit ? Math.min((value / limit) * 100, 100) : 0;

  return (
    <div className="bg-[#0a0a0a] border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {showLimit && limit && (
          <span className="text-xs text-slate-500">
            {Math.round(percentage)}% used
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-slate-500">{title}</div>
      {showLimit && limit && (
        <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PlanFeature({ 
  icon: Icon, 
  label, 
  value, 
  used,
  status = 'neutral'
}: { 
  icon: any; 
  label: string; 
  value: string; 
  used?: number;
  status?: 'success' | 'neutral';
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {used !== undefined && (
          <span className="text-sm text-slate-500">{used} /</span>
        )}
        <span className={`font-medium ${
          status === 'success' ? 'text-emerald-400' : 'text-white'
        }`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function QuickAction({ 
  href, 
  icon: Icon, 
  title, 
  description 
}: { 
  href: string; 
  icon: any; 
  title: string; 
  description: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-white flex items-center gap-2">
          {title}
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
        </h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </a>
  );
}
