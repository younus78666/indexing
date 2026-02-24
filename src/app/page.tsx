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

  const [activeTab, setActiveTab] = useState<'sitemap' | 'bulk'>('sitemap');
  const [bulkUrlsText, setBulkUrlsText] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [bulkAnalysis, setBulkAnalysis] = useState<{ url: string, status: 'checking' | 'done' | 'error', isIndexed?: boolean, coverageState?: string }[] | null>(null);

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

  const handleBulkSubmit = async (type: 'gsc' | 'indexnow', onlyUnindexed = false) => {
    let urlsToSubmit = bulkUrlsText
      .split('\n')
      .map(u => u.trim())
      .filter(u => u !== '' && u.startsWith('http'));

    if (onlyUnindexed && bulkAnalysis) {
      // Filter the original list to only include those we strictly know are not indexed
      urlsToSubmit = bulkAnalysis.filter(a => a.isIndexed === false).map(a => a.url);
    }

    if (urlsToSubmit.length === 0) {
      alert("No valid URLs found. Please ensure each line starts with http:// or https://");
      return;
    }

    if (urlsToSubmit.length > 200) {
      alert("Google allows a maximum of 200 indexing requests per day. Please reduce your list.");
      return;
    }

    setIsSubmitting(true);
    try {
      let successCount = 0;

      if (type === 'indexnow') {
        // IndexNow accepts bulk URLs natively in one payload!
        // Group by host in case user pasted multiple domains
        const hostGroups: { [key: string]: string[] } = {};
        for (const u of urlsToSubmit) {
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
        alert(`Successfully sent ${urlsToSubmit.length} URLs to IndexNow!`);
        setBulkUrlsText("");
        setBulkAnalysis(null);
      } else {
        // GSC API currently requires 1 API call per URL for indexing endpoint
        for (let i = 0; i < urlsToSubmit.length; i++) {
          const targetUrl = urlsToSubmit[i];
          await fetch('/api/gsc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl, type: 'URL_UPDATED' })
          });
          successCount++;

          // Very small artificial delay to avoid hitting Google's rate limits instantly
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        alert(`Successfully submitted ${successCount} URLs to Google Search Console for indexing!`);
        if (successCount === urlsToSubmit.length) {
          setBulkUrlsText("");
          setBulkAnalysis(null);
        }
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred during bulk submission. Re-check the console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkInspect = async () => {
    const urlsToInspect = bulkUrlsText
      .split('\n')
      .map(u => u.trim())
      .filter(u => u !== '' && u.startsWith('http'));

    if (urlsToInspect.length === 0) {
      alert("No valid URLs found to inspect.");
      return;
    }

    if (urlsToInspect.length > 50) {
      alert("To avoid Google rate limits, please inspect less than 50 URLs at a time.");
      return;
    }

    setIsInspecting(true);

    // Initialize state with 'checking' status for all
    const initialAnalysis = urlsToInspect.map(url => ({ url, status: 'checking' as const }));
    setBulkAnalysis(initialAnalysis);

    try {
      // Create a copy we can mutate
      let currentAnalysis = [...initialAnalysis];

      // We make requests sequentially (with small delays) to avoid hitting GSC quotas (QPS limit is usually ~5)
      for (let i = 0; i < urlsToInspect.length; i++) {
        const targetUrl = urlsToInspect[i];

        try {
          const res = await fetch('/api/gsc/inspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl, siteUrl: selectedSite })
          });

          if (!res.ok) throw new Error("API Error");
          const data = await res.json();

          // Update state incrementally
          currentAnalysis[i] = {
            url: targetUrl,
            status: 'done' as const,
            isIndexed: data.isIndexed,
            coverageState: data.coverageState
          };

          setBulkAnalysis([...currentAnalysis]);

        } catch (e) {
          currentAnalysis[i] = {
            url: targetUrl,
            status: 'error' as const,
            coverageState: 'Inspection Failed'
          };
          setBulkAnalysis([...currentAnalysis]);
        }

        // 500ms delay between inspections to be safe
        if (i < urlsToInspect.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

    } catch (e) {
      console.error("Inspection error", e);
      alert("A general error occurred during inspection.");
    } finally {
      setIsInspecting(false);
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <button
                onClick={() => setSelectedSite(null)}
                className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4 rotate-180" /> Back to Properties
              </button>

              {/* View Toggles */}
              <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('sitemap')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'sitemap' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  From Sitemap
                </button>
                <button
                  onClick={() => setActiveTab('bulk')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'bulk' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Bulk Paste
                </button>
              </div>
            </div>

            {activeTab === 'sitemap' ? (
              isLoadingUrls ? (
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
              )
            ) : (
              /* Bulk Paste View */
              <div className="bg-[#0a0a0a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-slate-200">Manual URL Submission & Inspection</h3>
                  <span className="text-xs text-slate-500">Google allows up to 200 URLs per day per property</span>
                </div>

                {bulkUrlsText.trim() === '' || !bulkAnalysis ? (
                  /* Input View */
                  <>
                    <textarea
                      value={bulkUrlsText}
                      onChange={(e) => {
                        setBulkUrlsText(e.target.value);
                        setBulkAnalysis(null);
                      }}
                      placeholder={`Paste your URLs here, one per line.\n\nExample:\nhttps://${selectedSite?.replace('sc-domain:', '') || 'example.com'}/new-blog-post\nhttps://${selectedSite?.replace('sc-domain:', '') || 'example.com'}/about-us`}
                      className="w-full h-64 bg-black/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-slate-400">
                        <span className="text-indigo-400 font-medium">{bulkUrlsText.split('\n').filter(u => u.trim() !== '' && u.startsWith('http')).length}</span> valid URLs detected
                      </div>
                      <button
                        onClick={handleBulkInspect}
                        disabled={isInspecting || bulkUrlsText.trim() === ''}
                        className="px-6 py-2.5 text-sm font-medium rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isInspecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        {isInspecting ? 'Inspecting Google Status...' : 'Check Index Status'}
                      </button>
                    </div>
                  </>
                ) : (
                  /* Results View */
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
                      <div className="flex gap-4">
                        <div className="text-sm">
                          <span className="text-slate-500">Total: </span>
                          <span className="text-slate-200 font-medium">{bulkAnalysis.length}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-500">Indexed: </span>
                          <span className="text-emerald-400 font-medium">{bulkAnalysis.filter(a => a.isIndexed).length}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-500">Not Indexed: </span>
                          <span className="text-amber-400 font-medium">{bulkAnalysis.filter(a => a.status === 'done' && !a.isIndexed).length}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setBulkAnalysis(null)}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        Start Over
                      </button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto mb-6 pr-2">
                      <ul className="space-y-2">
                        {bulkAnalysis.map((item, i) => (
                          <li key={i} className="p-3 bg-black/40 border border-slate-800 rounded-lg flex justify-between items-center">
                            <div className="flex items-center gap-3 overflow-hidden">
                              {item.status === 'checking' ? (
                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                              ) : item.isIndexed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                              )}
                              <span className={`text-sm truncate ${item.isIndexed === false ? 'text-slate-200 font-medium' : 'text-slate-400'}`} title={item.url}>
                                {item.url}
                              </span>
                            </div>
                            <div className="shrink-0 text-xs text-right ml-4">
                              {item.status === 'checking' ? (
                                <span className="text-indigo-400">Checking...</span>
                              ) : item.isIndexed ? (
                                <span className="text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Indexed</span >
                              ) : (
                                <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded">{item.coverageState || 'Not Indexed'}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                      <button
                        onClick={() => handleBulkSubmit('indexnow', true)}
                        disabled={isSubmitting || bulkAnalysis.filter(a => a.status === 'done' && !a.isIndexed).length === 0}
                        className="px-6 py-2.5 text-sm font-medium rounded-xl bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 border border-emerald-500/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <img src="https://www.bing.com/sa/simg/favicon-2x.ico" className="w-4 h-4 rounded-full opacity-70" alt="Bing" />
                        Bing ({bulkAnalysis.filter(a => a.status === 'done' && !a.isIndexed).length} Unindexed)
                      </button>
                      <button
                        onClick={() => handleBulkSubmit('gsc', true)}
                        disabled={isSubmitting || bulkAnalysis.filter(a => a.status === 'done' && !a.isIndexed).length === 0}
                        className="px-6 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20 disabled:cursor-not-allowed"
                      >
                        <Globe className="w-4 h-4" />
                        {isSubmitting ? 'Submitting...' : `Google (${bulkAnalysis.filter(a => a.status === 'done' && !a.isIndexed).length} Unindexed)`}
                      </button>
                    </div>
                  </div>
                )}
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
