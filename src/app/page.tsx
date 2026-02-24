"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Search, Plus, Globe, Settings, Activity, ArrowRight, ShieldCheck, Mail, AlertCircle, CheckCircle2, LogOut, LogIn } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [domain, setDomain] = useState("");

  // mock data
  const websites = [
    { domain: "calcowa.com", status: "verified", lastIndexed: "2 hours ago", indexingPending: 15 },
    { domain: "example.com", status: "pending", lastIndexed: "-", indexingPending: 0 },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 border-b border-indigo-500/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-xl tracking-tight text-white">IndexPro™</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
              <Settings className="w-5 h-5 text-slate-400" />
            </button>
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
              Dashboard
            </h1>
            <p className="text-slate-400 text-lg">
              Manage your websites and automate search engine indexing effortlessly.
            </p>
          </div>
          {status === "authenticated" && (
            <button
              onClick={() => setIsAddingMode(!isAddingMode)}
              className="group relative inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-full hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
            >
              {isAddingMode ? "Cancel" : "Add New Domain"}
              {!isAddingMode && <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />}
            </button>
          )}
        </div>

        {status === "unauthenticated" ? (
          <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/5 to-transparent p-12 backdrop-blur-sm flex flex-col items-center text-center">
            <ShieldCheck className="w-16 h-16 text-indigo-400 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">Connect Your Search Console</h2>
            <p className="text-slate-400 max-w-lg mb-8">
              Sign in with your Google Account to securely connect your Search Console and automate indexing across Google and Bing.
            </p>
            <button
              onClick={() => signIn('google')}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3 text-lg"
            >
              Sign in with Google
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            {/* Add Domain Section (Animated) */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isAddingMode ? 'max-h-[800px] opacity-100 mb-12' : 'max-h-0 opacity-0'}`}>
              <div className="relative rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/5 to-transparent p-8 backdrop-blur-sm overflow-hidden flex flex-col md:flex-row gap-8 items-center">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -z-10 animate-pulse"></div>

                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-white mb-1">Add a New Website</h2>
                    <p className="text-slate-400">Enter the domain you want to manage. Must be a property in your Google Search Console.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Globe className="h-5 w-5 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3 bg-black/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        placeholder="https://example.com"
                      />
                    </div>
                    <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2">
                      Verify Ownership
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Instructions */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex gap-4">
                      <AlertCircle className="w-6 h-6 text-emerald-500 shrink-0" />
                      <div className="space-y-2">
                        <p className="font-medium text-slate-200">OAuth Verified</p>
                        <p className="text-sm text-slate-400 leading-relaxed">We will securely verify your ownership via your connected Google Account. No manual TXT records required for Google!</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual element on right */}
                <div className="hidden lg:flex w-72 h-64 border border-dashed border-slate-700 rounded-xl items-center justify-center bg-black/20 relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-emerald-500/5 rounded-xl"></div>
                  <div className="text-center space-y-3 z-10 w-full px-6">
                    <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
                    <p className="text-sm text-slate-400 font-medium tracking-wide uppercase">Direct Auth</p>
                    <div className="h-px w-full bg-slate-800 my-2"></div>
                    <div className="flex justify-center gap-3">
                      <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">GSC</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Websites Grid */}
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span>Active Properties</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs text-center">{websites.length}</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {websites.map((site, i) => (
                <div key={i} className="group relative rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6 hover:bg-[#111] hover:border-slate-700 transition-all duration-300 overflow-hidden shadow-xl">
                  {/* Hover gradient effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all opacity-0 group-hover:opacity-100"></div>

                  <div className="flex justify-between items-start mb-6 drop-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-700">
                        <Globe className="w-5 h-5 text-slate-300" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-200">{site.domain}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          {site.status === "verified" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span className={`text-xs ${site.status === "verified" ? "text-emerald-500" : "text-amber-500"}`}>
                            {site.status === "verified" ? "Verified" : "Action Needed"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button className="text-slate-600 hover:text-white transition-colors">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 rounded-lg bg-black/40 border border-slate-800/50">
                      <p className="text-xs text-slate-500 mb-1">Last Indexed</p>
                      <p className="font-medium text-slate-300">{site.lastIndexed}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-slate-800/50">
                      <p className="text-xs text-slate-500 mb-1">Queue</p>
                      <p className="font-medium text-slate-300">{site.indexingPending} URLs</p>
                    </div>
                  </div>

                  <button
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors border ${site.status === "verified"
                        ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                      }`}
                  >
                    {site.status === "verified" ? "Manage Indexing" : "Complete Verification"}
                  </button>
                </div>
              ))}

              {/* Empty State / Add Card */}
              <button
                onClick={() => setIsAddingMode(true)}
                className="rounded-2xl border border-dashed border-slate-700 bg-black/10 p-6 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all duration-300 min-h-[250px]"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800/50 mb-4 flex items-center justify-center border border-slate-700/50">
                  <Plus className="w-6 h-6" />
                </div>
                <p className="font-medium">Add another website</p>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
