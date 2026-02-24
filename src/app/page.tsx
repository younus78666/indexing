"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Search, Plus, Globe, Settings, Activity, ArrowRight, ShieldCheck, Mail, AlertCircle, CheckCircle2, LogOut, LogIn, Link, Loader2, Send } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();

  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);

  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [isLoadingUrls, setIsLoadingUrls] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch sites when user authenticates
  useEffect(() => {
    if (status === "authenticated") {
      fetchSites();
    }
  }, [status]);

  const fetchSites = async () => {
    setIsLoadingSites(true);
    try {
      const res = await fetch("/api/gsc/sites");
      const data = await res.json();
      if (data.success) {
        setSites(data.sites);
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
    try {
      // Fix for sc-domain: prefix which trips up some URL parsers if not fully encoded twice or handled properly
      const queryParam = encodeURIComponent(siteUrl);
      const res = await fetch(`/api/gsc/urls?siteUrl=${queryParam}`);

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.urls) {
        setUrls(data.urls);
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

  const submitIndexing = async (targetUrl: string, type: 'gsc' | 'indexnow') => {
    setIsSubmitting(true);
    try {
      if (type === 'gsc') {
        await fetch('/api/gsc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl, type: 'URL_UPDATED' })
        });
        alert(`Successfully requested indexing for ${targetUrl} via Google`);
      } else {
        // Determine host dynamically from URL
        const urlObj = new URL(targetUrl);
        const host = urlObj.host;
        // In a real app we would get the key dynamically or from the db
        const key = "example-verification-key";

        await fetch('/api/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host, key, urls: [targetUrl] })
        });
        alert(`Successfully sent ${targetUrl} to IndexNow`);
      }
    } catch (e) {
      alert("Failed to submit for indexing. See console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 border-b border-indigo-500/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-xl tracking-tight text-white cursor-pointer" onClick={() => setSelectedSite(null)}>IndexPro™</span>
          </div>
          <div className="flex items-center gap-4">
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
                  onClick={() => signOut()}
                  className="p-2 ml-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
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
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-12">
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
            <p className="text-slate-400 max-w-lg mb-8">
              Sign in with your Google Account to automatically pull your verified properties and start indexing pages immediately.
            </p>
            <button
              onClick={() => signIn('google')}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3 text-lg"
            >
              Sign in with Google
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        ) : selectedSite ? (
          /* URLs View */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button
              onClick={() => setSelectedSite(null)}
              className="mb-6 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-2"
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
                <div className="p-4 border-b border-slate-800 bg-black/40 flex justify-between items-center">
                  <span className="font-medium text-slate-300">Found {urls.length} URLs in Sitemap</span>
                </div>
                <ul className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
                  {urls.map((url, i) => (
                    <li key={i} className="p-4 hover:bg-slate-900/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden text-ellipsis">
                        <Link className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-sm text-slate-300 truncate" title={url}>{url}</span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => submitIndexing(url, 'gsc')}
                          disabled={isSubmitting}
                          className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors flex items-center gap-2"
                        >
                          <Send className="w-3 h-3" />
                          GSC Index
                        </button>
                        <button
                          onClick={() => submitIndexing(url, 'indexnow')}
                          disabled={isSubmitting}
                          className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                        >
                          <Send className="w-3 h-3" />
                          Bing IndexNow
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-12 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-500 bg-black/20">
                <AlertCircle className="w-8 h-8 mb-4 text-amber-500/70" />
                <p className="font-medium text-slate-300">No URLs Found</p>
                <p className="text-sm mt-2 text-center max-w-md">We couldn't find a valid sitemap for this property in Google Search Console, or the sitemap is empty.</p>
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
                          <div className="flex items-center gap-1.5 mt-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs text-emerald-500">GSC Verified Entry</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-3 rounded-lg bg-black/40 border border-slate-800/50">
                        <p className="text-xs text-slate-500 mb-1">Permission Level</p>
                        <p className="font-medium text-slate-300 capitalize">{site.permissionLevel.toLowerCase()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-black/40 border border-slate-800/50">
                        <p className="text-xs text-slate-500 mb-1">URL Prefix</p>
                        <p className="font-medium text-slate-300">{site.siteUrl.startsWith('sc-domain:') ? 'Domain Prop.' : 'URL Prefix'}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => fetchUrlsForSite(site.siteUrl)}
                      className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 flex flex-row items-center justify-center gap-2"
                    >
                      Fetch URLs <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-500 bg-black/20">
                <AlertCircle className="w-8 h-8 mb-4 text-amber-500/70" />
                <p className="font-medium text-slate-300">No Verified Properties Found</p>
                <p className="text-sm mt-2 text-center max-w-md">There are no properties verified in the Google Search Console account you logged in with. Please log in with the account that owns the domains.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
