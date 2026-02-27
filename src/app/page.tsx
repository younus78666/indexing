"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Search, Globe, Activity, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, LogOut, LogIn, Link, Loader2, Send, Zap, RefreshCw, BarChart3, CreditCard } from "lucide-react";

type UrlAnalysis = {
  status: 'checking' | 'done' | 'error';
  isIndexed?: boolean;
  coverageState?: string;
};

interface UsageData {
  usage: {
    gscRequestsToday: number;
    indexNowRequestsToday: number;
    urlsIndexedToday: number;
  };
  limits: {
    gscRequestsPerDay: number;
    indexNowRequestsPerDay: number;
    urlsPerBatch: number;
    sites: number;
    bulkIndexing: boolean;
  };
  plan: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [usage, setUsage] = useState<UsageData | null>(null);

  // App Level State
  const [activeApp, setActiveApp] = useState<'console' | 'indexer'>('console');

  // GSC State
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const [urls, setUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [urlAnalyses, setUrlAnalyses] = useState<Record<string, UrlAnalysis>>({});

  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [isLoadingUrls, setIsLoadingUrls] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  
  // Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  // Indexer State
  const [indexerUrls, setIndexerUrls] = useState("");
  const [indexerCampaign, setIndexerCampaign] = useState("");
  const [isIndexerSubmitting, setIsIndexerSubmitting] = useState(false);
  const [indexerResult, setIndexerResult] = useState<string | null>(null);

  // Fetch usage data
  useEffect(() => {
    if (status === "authenticated") {
      fetchUsage();
    }
  }, [status]);

  // Fetch sites when user authenticates
  useEffect(() => {
    if (status === "authenticated" && activeApp === 'console') {
      fetchSites();
    }
  }, [status, activeApp]);

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSites = async () => {
    if (sites.length > 0) return; // Prevent over-fetching
    setIsLoadingSites(true);
    try {
      const res = await fetch("/api/gsc/sites");
      const data = await res.json();
      if (data.success) {
        setSites(data.sites);
        if (data.hasMoreSites) {
          setUpgradeMessage(data.upgradeMessage);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSites(false);
    }
  };

  const fetchUrlsForSite = async (siteUrl: string) => {
    setSelectedSite(siteUrl);
    setIsLoadingUrls(true);
    setUrls([]);
    setSelectedUrls([]);
    setUrlAnalyses({});

    try {
      const queryParam = encodeURIComponent(siteUrl);
      const res = await fetch(`/api/gsc/urls?siteUrl=${queryParam}`);

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.urls) {
        setUrls(data.urls);
        setSelectedUrls([]);
      } else {
        alert(data.message || data.error || "No sitemaps found.");
      }
    } catch (e: any) {
      console.error("Fetch URLs Error:", e);
      alert("Failed to fetch URLs. Check console for error.");
    } finally {
      setIsLoadingUrls(false);
    }
  };

  const checkAndShowUpgrade = (message: string) => {
    setUpgradeMessage(message);
    setShowUpgradeModal(true);
  };

  const submitIndexing = async (targetUrls: string[], type: 'gsc' | 'indexnow') => {
    if (targetUrls.length === 0) return;
    
    // Check if user has plan limits
    if (!usage) {
      checkAndShowUpgrade('Please sign in to use this feature.');
      return;
    }

    if (type === 'gsc') {
      if (targetUrls.length > 200) {
        alert("Google allows a maximum of 200 indexing requests per day per property.");
        return;
      }
      
      // Check bulk indexing permission
      if (targetUrls.length > 1 && !usage.limits.bulkIndexing) {
        checkAndShowUpgrade('Bulk indexing requires a paid plan. Upgrade to submit multiple URLs at once.');
        return;
      }

      // Check if daily limit would be exceeded
      if (usage.usage.gscRequestsToday + targetUrls.length > usage.limits.gscRequestsPerDay) {
        checkAndShowUpgrade(`You've reached your daily limit of ${usage.limits.gscRequestsPerDay} GSC requests. Upgrade for more.`);
        return;
      }
    } else {
      if (usage.usage.indexNowRequestsToday + targetUrls.length > usage.limits.indexNowRequestsPerDay) {
        checkAndShowUpgrade(`You've reached your daily limit of ${usage.limits.indexNowRequestsPerDay} IndexNow requests. Upgrade for more.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let successCount = 0;

      if (type === 'indexnow') {
        const hostGroups: { [key: string]: string[] } = {};
        for (const u of targetUrls) {
          const host = new URL(u).host;
          if (!hostGroups[host]) hostGroups[host] = [];
          hostGroups[host].push(u);
        }

        for (const host of Object.keys(hostGroups)) {
          await fetch('/api/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, key: "example-verification-key", urls: hostGroups[host] })
          });
        }
        alert(`Successfully sent ${targetUrls.length} URLs to IndexNow!`);
      } else {
        for (let i = 0; i < targetUrls.length; i++) {
          const res = await fetch('/api/gsc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrls[i], type: 'URL_UPDATED' })
          });
          
          if (res.status === 429) {
            const data = await res.json();
            checkAndShowUpgrade(data.error || 'Usage limit exceeded');
            break;
          }
          
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        alert(`Successfully submitted ${successCount} URLs to Google Search Console for indexing!`);
      }
      
      // Refresh usage after submission
      fetchUsage();
    } catch (e) {
      console.error(e);
      alert("An error occurred during submission. Re-check the console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInspectSelected = async () => {
    if (selectedUrls.length === 0) {
      alert("No URLs selected to inspect.");
      return;
    }

    if (selectedUrls.length > 50) {
      alert("To avoid Google rate limits, please inspect less than 50 URLs at a time.");
      return;
    }

    // Check usage limits
    if (!usage) {
      checkAndShowUpgrade('Please sign in to use this feature.');
      return;
    }

    if (usage.usage.gscRequestsToday + selectedUrls.length > usage.limits.gscRequestsPerDay) {
      checkAndShowUpgrade(`You've reached your daily limit of ${usage.limits.gscRequestsPerDay} GSC requests. Upgrade for more.`);
      return;
    }

    setIsInspecting(true);

    setUrlAnalyses(prev => {
      const next = { ...prev };
      for (const url of selectedUrls) {
        next[url] = { status: 'checking' };
      }
      return next;
    });

    try {
      for (let i = 0; i < selectedUrls.length; i++) {
        const targetUrl = selectedUrls[i];

        try {
          const res = await fetch('/api/gsc/inspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl, siteUrl: selectedSite })
          });

          if (res.status === 429) {
            const data = await res.json();
            checkAndShowUpgrade(data.error || 'Usage limit exceeded');
            break;
          }

          if (!res.ok) throw new Error("API Error");
          const data = await res.json();

          setUrlAnalyses(prev => ({
            ...prev,
            [targetUrl]: {
              status: 'done',
              isIndexed: data.isIndexed,
              coverageState: data.coverageState
            }
          }));

        } catch (e) {
          setUrlAnalyses(prev => ({
            ...prev,
            [targetUrl]: {
              status: 'error',
              coverageState: 'Inspection Failed'
            }
          }));
        }

        if (i < selectedUrls.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      // Refresh usage
      fetchUsage();
    } catch (e) {
      console.error("Inspection error", e);
      alert("A general error occurred during inspection.");
    } finally {
      setIsInspecting(false);
    }
  };

  const toggleUrlSelection = (url: string) => {
    if (selectedUrls.includes(url)) {
      setSelectedUrls(prev => prev.filter(u => u !== url));
    } else {
      setSelectedUrls(prev => [...prev, url]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUrls([...urls]);
    } else {
      setSelectedUrls([]);
    }
  };

  const submitToIndexer = async () => {
    const urlsToSubmit = indexerUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u !== '' && u.startsWith('http'));

    if (urlsToSubmit.length === 0) {
      alert("No valid URLs found.");
      return;
    }
    
    // Check batch size limit
    if (usage && urlsToSubmit.length > usage.limits.urlsPerBatch) {
      checkAndShowUpgrade(`Your plan allows ${usage.limits.urlsPerBatch} URLs per batch. Upgrade for larger batches.`);
      return;
    }

    setIsIndexerSubmitting(true);
    setIndexerResult(null);
    try {
      const res = await fetch('/api/indexer/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlsToSubmit, campaignName: indexerCampaign })
      });
      const data = await res.json();
      if (data.success) {
        setIndexerResult("Successfully sent batch to Omega Indexer!");
        setIndexerUrls("");
        setIndexerCampaign("");
      } else {
        alert(data.error || "Submission failed.");
      }
    } catch (e) {
      alert("Error submitting to indexer.");
    } finally {
      setIsIndexerSubmitting(false);
    }
  };

  // Calculate usage percentage
  const gscUsagePercent = usage 
    ? Math.min((usage.usage.gscRequestsToday / usage.limits.gscRequestsPerDay) * 100, 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Upgrade Required</h3>
            </div>
            <p className="text-slate-400 mb-6">{upgradeMessage}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Maybe Later
              </button>
              <a
                href="/pricing"
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-center font-medium"
              >
                View Plans
              </a>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-indigo-500/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-xl tracking-tight text-white cursor-pointer" onClick={() => setSelectedSite(null)}>IndexPro™</span>
            </div>
            {/* App Toggle Menu */}
            <div className="hidden sm:flex bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button onClick={() => setActiveApp('console')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeApp === 'console' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>Search Console</button>
              <button onClick={() => setActiveApp('indexer')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeApp === 'indexer' ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:text-slate-200'} flex items-center gap-1.5`}><Zap className="w-3.5 h-3.5" /> Fast Indexer</button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Usage Indicator */}
            {status === "authenticated" && usage && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-400">
                    {usage.usage.gscRequestsToday} / {usage.limits.gscRequestsPerDay}
                  </span>
                </div>
                <div className="w-px h-3 bg-slate-700" />
                <a href="/dashboard" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  Dashboard
                </a>
              </div>
            )}

            {/* Mobile App Toggle Menu */}
            <div className="sm:hidden flex bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button onClick={() => setActiveApp('console')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeApp === 'console' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>GSC</button>
              <button onClick={() => setActiveApp('indexer')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeApp === 'indexer' ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400'} flex items-center gap-1`}><Zap className="w-3 h-3" /></button>
            </div>

            {status === "authenticated" && session.user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-medium text-slate-200">{session.user.name}</span>
                  <span className="text-xs text-slate-500">{session.user.email}</span>
                </div>
                {session.user.image ? (
                  <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-700" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-900 to-slate-800 border border-slate-700 flex items-center justify-center text-sm font-medium">
                    {session.user.name?.[0] || 'U'}
                  </div>
                )}
                <button
                  onClick={() => { setSites([]); setSelectedSite(null); setUrls([]); signIn('google', undefined, { prompt: 'select_account' }); }}
                  className="p-2 ml-1 rounded-full text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                  title="Switch Google Account"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => signOut()}
                  className="p-2 ml-1 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn('google')}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/5"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Plan Banner for Free Users */}
        {status === "authenticated" && usage?.plan === 'FREE' && (
          <div className="mb-8 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">You're on the Free plan</h3>
                <p className="text-sm text-slate-400">Get more indexing power with our paid plans</p>
              </div>
            </div>
            <a
              href="/pricing"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Upgrade
            </a>
          </div>
        )}

        {activeApp === 'indexer' ? (
          /* Backlink Indexer View */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight flex items-center gap-3">
                  <Zap className="w-8 h-8 text-amber-500" /> Fast Backlink Indexer
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl">
                  Submit ANY URL (even those you don't own) for rapid indexing via our external proxy network.
                </p>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 max-w-3xl">
              {indexerResult && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>{indexerResult}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Campaign Name (Optional)</label>
                <input
                  type="text"
                  value={indexerCampaign}
                  onChange={(e) => setIndexerCampaign(e.target.value)}
                  placeholder="e.g. Guest Posts - March 2026"
                  className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex justify-between">
                  <span>URLs to Index</span>
                  {usage && (
                    <span className="text-slate-500">
                      {indexerUrls.split('\n').filter(u => u.trim() !== '' && u.startsWith('http')).length} / {usage.limits.urlsPerBatch} URLs
                    </span>
                  )}
                </label>
                <textarea
                  value={indexerUrls}
                  onChange={(e) => setIndexerUrls(e.target.value)}
                  placeholder={`http://example.com/guest-post-1\nhttp://example.com/profile-link`}
                  className="w-full h-64 bg-black/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={submitToIndexer}
                  disabled={isIndexerSubmitting || indexerUrls.trim() === ''}
                  className="px-6 py-2.5 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/20 disabled:cursor-not-allowed"
                >
                  {isIndexerSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isIndexerSubmitting ? 'Submitting...' : 'Submit to OmegaIndexer ($0.02/link)'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Search Console View */
          <>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                  {selectedSite ? "Manage URLs" : "Dashboard"}
                </h1>
                <p className="text-slate-400 text-lg">
                  {selectedSite ? `Showing sitemap URLs for ${selectedSite}` : "Manage your verified Google Search Console properties."}
                </p>
              </div>
            </div>

            {status === "unauthenticated" ? (
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/5 to-transparent p-12 backdrop-blur-sm flex flex-col items-center text-center mt-12">
                <ShieldCheck className="w-16 h-16 text-indigo-400 mb-6" />
                <h2 className="text-2xl font-bold text-white mb-4">Connect Your Search Console</h2>
                <p className="text-slate-400 mb-6 max-w-md">Sign in with Google to access your Search Console properties and start indexing your URLs.</p>
                <button
                  onClick={() => signIn('google')}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl flex items-center gap-3"
                >
                  Sign in with Google <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ) : selectedSite ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button
                  onClick={() => setSelectedSite(null)}
                  className="mb-8 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-2"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" /> Back to Properties
                </button>

                {isLoadingUrls ? (
                  <div className="p-12 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                    <p>Fetching sitemaps and URLs from Google...</p>
                  </div>
                ) : urls.length > 0 ? (
                  <div className="bg-[#0a0a0a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    {/* Usage Bar */}
                    {usage && (
                      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-400">Daily GSC Usage</span>
                          <span className={gscUsagePercent > 80 ? 'text-red-400' : 'text-slate-400'}>
                            {usage.usage.gscRequestsToday} / {usage.limits.gscRequestsPerDay} requests
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              gscUsagePercent > 80 ? 'bg-red-500' : gscUsagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${gscUsagePercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="p-4 border-b border-slate-800 bg-black/40 flex justify-between items-center sm:flex-row flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 font-medium bg-white/5 py-1.5 px-3 rounded-lg hover:bg-white/10 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedUrls.length === urls.length && urls.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-slate-600 bg-black/50 text-indigo-500 focus:ring-indigo-500/50 w-4 h-4"
                          />
                          {selectedUrls.length === urls.length ? 'Deselect All' : 'Select All'} ({selectedUrls.length}/{urls.length})
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={handleInspectSelected}
                          disabled={isInspecting || selectedUrls.length === 0}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isInspecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 text-slate-300" />}
                          Test Google Indexing
                        </button>
                        <button
                          onClick={() => submitIndexing(selectedUrls, 'gsc')}
                          disabled={isSubmitting || selectedUrls.length === 0}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 border border-indigo-500 hover:bg-indigo-500 transition-colors flex items-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                          {isSubmitting ? 'Submitting...' : 'Bulk GSC Index'}
                        </button>
                        <button
                          onClick={() => submitIndexing(selectedUrls, 'indexnow')}
                          disabled={isSubmitting || selectedUrls.length === 0}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 border border-emerald-500 hover:bg-emerald-500 transition-colors flex items-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src="https://www.bing.com/sa/simg/favicon-2x.ico" className="w-4 h-4 rounded-full" alt="Bing" />}
                          {isSubmitting ? 'Submitting...' : 'Bulk Bing Index'}
                        </button>
                      </div>
                    </div>

                    <ul className="divide-y divide-slate-800/50 max-h-[700px] overflow-y-auto">
                      {urls.map((url, i) => {
                        const isSelected = selectedUrls.includes(url);
                        const analysis = urlAnalyses[url];

                        return (
                          <li key={i} className={`p-4 hover:bg-slate-900/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${isSelected ? 'bg-indigo-950/20' : ''}`}>
                            <div className="flex items-center gap-3 overflow-hidden text-ellipsis flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleUrlSelection(url)}
                                className="rounded border-slate-600 bg-black/50 text-indigo-500 focus:ring-indigo-500/50 w-4 h-4 cursor-pointer"
                              />
                              <Link className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="text-sm text-slate-300 truncate" title={url}>{url}</span>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 justify-end w-full lg:w-auto mt-2 lg:mt-0">
                              {/* Status Display */}
                              {analysis && (
                                <div className="flex items-center text-xs w-[120px] justify-start lg:justify-end">
                                  {analysis.status === 'checking' ? (
                                    <span className="text-indigo-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Testing...</span>
                                  ) : analysis.isIndexed ? (
                                    <span className="text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded flex items-center gap-1 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Indexed</span>
                                  ) : (
                                    <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded flex items-center gap-1 border border-amber-500/20" title={analysis.coverageState}><AlertCircle className="w-3 h-3" /> Not Indexed</span>
                                  )}
                                </div>
                              )}

                              {/* Individual Actions */}
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => submitIndexing([url], 'gsc')}
                                  disabled={isSubmitting}
                                  className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors flex items-center gap-2 min-w-[120px] justify-center"
                                >
                                  <Send className="w-3 h-3" />
                                  {analysis?.isIndexed ? 'Index Again' : 'GSC Index Now'}
                                </button>
                                <button
                                  onClick={() => submitIndexing([url], 'indexnow')}
                                  disabled={isSubmitting}
                                  className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-2 min-w-[100px] justify-center"
                                >
                                  <img src="https://www.bing.com/sa/simg/favicon-2x.ico" className="w-3 h-3 rounded-full opacity-70" alt="Bing" />
                                  Bing Index
                                </button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="p-12 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-500 bg-black/20">
                    <AlertCircle className="w-8 h-8 mb-4 text-amber-500/70" />
                    <p className="font-medium text-slate-300">No URLs Found</p>
                    <p className="text-sm mt-2 text-center max-w-md">We couldn't find a valid sitemap for this property in Google Search Console.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Sites Grid View */
              <>
                {isLoadingSites ? (
                  <div className="p-12 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                    <p>Loading your verified Search Console properties...</p>
                  </div>
                ) : sites.length > 0 ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sites.map((site, i) => (
                      <div key={i} className="group relative rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6 hover:bg-[#111] hover:border-slate-700 transition-all duration-300 overflow-hidden shadow-xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all opacity-0 group-hover:opacity-100 pointer-events-none z-0"></div>

                        <div className="relative z-10 flex justify-between items-start mb-6 drop-shadow">
                          <div className="flex items-center gap-3 max-w-full">
                            <div className="w-10 h-10 shrink-0 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-700">
                              <Globe className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="overflow-hidden">
                              <h3 className="font-medium text-slate-200 truncate pr-2" title={site.siteUrl}>
                                {site.siteUrl.replace('https://', '').replace(/\/$/, '') || site.siteUrl}
                              </h3>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => fetchUrlsForSite(site.siteUrl)}
                          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 flex flex-row items-center justify-center gap-2"
                        >
                          Fetch Sitemap URLs <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-500 bg-black/20">
                    <AlertCircle className="w-8 h-8 mb-4 text-amber-500/70" />
                    <p className="font-medium text-slate-300">No Verified Properties Found</p>
                    <p className="text-sm mt-2 text-center max-w-md">Connect a Google Search Console property to get started.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
