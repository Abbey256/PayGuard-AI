import { Link } from "react-router";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-sans">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="PayGuard AI" className="h-9 w-auto" />
          <span className="text-xl font-bold tracking-tight">PayGuard AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/signin" className="text-sm text-slate-400 hover:text-white transition px-4 py-2">
            Sign in
          </Link>
          <Link to="/signup" className="text-sm bg-emerald-600 hover:bg-emerald-700 transition px-5 py-2.5 rounded-lg font-semibold shadow-lg shadow-emerald-900/30">
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-2 rounded-full mb-8">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block"></span>
          ₦49.9 billion paid to ghost workers in the first half of 2022 alone — ICPC
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
          Nigeria's salary fraud problem
          <br />
          <span className="text-emerald-400">has a biometric solution.</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          PayGuard AI stops ghost workers before a single naira leaves the wallet.
          Every staff member proves they are alive, present, and who they claim to be —
          directly on their phone — before their salary is released.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup"
            className="bg-emerald-600 hover:bg-emerald-700 transition px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/30">
            Create Agency Account →
          </Link>
          <Link to="/signin"
            className="border border-white/15 hover:border-white/30 transition px-8 py-4 rounded-xl font-semibold text-lg text-slate-300 hover:text-white">
            Sign In to Dashboard
          </Link>
        </div>
      </section>

      {/* Real News Section */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-center text-xs font-bold tracking-widest text-slate-500 uppercase mb-10">
          Documented Cases Across Nigeria
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              year: "2021",
              state: "Borno State",
              headline: "22,500 ghost workers discovered costing ₦420M per month",
              source: "Punch Nigeria",
              url: "https://punchng.com/tackling-ghost-workers-syndrome/",
              tag: "State Payroll",
            },
            {
              year: "2022",
              state: "Federal Government",
              headline: "₦49.9 billion tracked as salaries for non-existent workers in just 6 months",
              source: "ICPC / Legit.ng",
              url: "https://www.legit.ng/business-economy/economy/1492507-how-federal-government-ministries-agencies-padded-20212022-budget-n300-billion-icpc/",
              tag: "Federal MDAs",
            },
            {
              year: "2024",
              state: "Pension Fraud",
              headline: "ICPC recovered ₦20 billion in ghost worker pension deductions",
              source: "Premium Times",
              url: "https://www.premiumtimesng.com/news/top-news/772152-how-icpc-recovered-n20bn-ghost-workers-pension-deductions-in-2024-chairperson.html",
              tag: "Pension",
            },
            {
              year: "2018",
              state: "Kogi State",
              headline: "About 8,000 phantom employees uncovered on state payroll",
              source: "Punch Nigeria",
              url: "https://punchng.com/tackling-ghost-workers-syndrome/",
              tag: "State Payroll",
            },
            {
              year: "2016",
              state: "Federal Government",
              headline: "24,000 ghost workers removed — saving ₦2.29B per month ($11.5M)",
              source: "Newsweek",
              url: "https://www.newsweek.com/nigeria-saves-115-million-culling-24000-ghost-workers-431296",
              tag: "Audit Exercise",
            },
            {
              year: "2020",
              state: "IPPIS Fraud",
              headline: "Civil servants arraigned for inserting ghost workers into IPPIS — ₦140M stolen",
              source: "Nairaland / FG",
              url: "https://ww.nairaland.com/6046418/civil-servants-ex-banker-arraigned-ippis",
              tag: "Criminal Case",
            },
          ].map(({ year, state, headline, source, url, tag }) => (
            <a key={headline} href={url} target="_blank" rel="noopener noreferrer"
              className="group block bg-white/4 border border-white/8 hover:border-emerald-500/30 hover:bg-white/6 rounded-2xl p-5 transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{tag}</span>
                <span className="text-xs text-slate-500">{year}</span>
              </div>
              <p className="text-sm font-semibold text-white leading-snug mb-3 group-hover:text-emerald-100 transition">{headline}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{state}</span>
                <span className="text-xs text-slate-600 group-hover:text-emerald-500 transition">{source} ↗</span>
              </div>
            </a>
          ))}
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">
          Sources: ICPC, Punch Nigeria, Premium Times, Newsweek, Legit.ng. Click any card to read the original report.
        </p>
      </section>

      {/* The PayGuard Solution */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">How PayGuard AI Works</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            No hardware. No agents. No manual audits. Just a link on a worker's phone — and an AI that knows the difference between a real person and a fraud attempt.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              num: "01",
              title: "HR uploads staff",
              body: "Upload staff records and photos via CSV or manually. Each worker gets their own verified profile.",
            },
            {
              num: "02",
              title: "Worker gets a link",
              body: "One-time verification link sent to the worker's phone. No app download required — just a browser.",
            },
            {
              num: "03",
              title: "Live biometric check",
              body: "Worker completes 3 randomised challenges — blink, smile, head turn — in an unpredictable order. Pre-recorded videos cannot pass.",
            },
            {
              num: "04",
              title: "Pay verified staff only",
              body: "HR approves the batch. Salaries are disbursed only to workers who passed biometric verification.",
            },
          ].map(({ num, title, body }) => (
            <div key={num} className="bg-white/4 border border-white/8 rounded-2xl p-6">
              <div className="text-xs font-black text-emerald-500 tracking-widest mb-4">{num}</div>
              <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900/60 border border-emerald-900/40 rounded-3xl p-8 sm:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold mb-3">Built to Block Every Attack Vector</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              A determined fraudster knows the API. We built the system assuming they do.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "HMAC-signed challenge nonces", body: "Every verification session is tied to a server-issued cryptographic proof. You cannot fake biometric data through the API — the server will reject it with a fraud log." },
              { title: "Server-side score recomputation", body: "The browser sends data. The server ignores the browser's verdict entirely and recomputes the trust score itself. Client manipulation is structurally impossible." },
              { title: "Unpredictable challenge sequence", body: "The server picks blink/smile/headturn order using crypto.getRandomValues each session. You cannot prepare a video that will pass — you don't know the order in advance." },
              { title: "Bank account name verification", body: "Before every transfer, Squad API verifies the account holder name matches the payroll name. Identity swaps are blocked at the payment gate." },
            ].map(({ title, body }) => (
              <div key={title} className="flex gap-4 bg-black/20 rounded-xl p-5">
                <div className="mt-0.5 shrink-0">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white mb-1">{title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact numbers */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { value: "₦200B+", label: "Estimated annual ghost worker cost to Nigeria", source: "Business Day" },
            { value: "22,500", label: "Ghost workers found in Borno alone — ₦420M/month", source: "2021, Punch" },
            { value: "< 30s", label: "Average time to complete biometric verification", source: "PayGuard AI" },
          ].map(({ value, label, source }) => (
            <div key={label} className="text-center bg-white/4 border border-white/8 rounded-2xl p-8">
              <div className="text-4xl font-black text-emerald-400 mb-3">{value}</div>
              <div className="text-sm text-white font-medium mb-1">{label}</div>
              <div className="text-xs text-slate-500">{source}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-extrabold mb-4">
          Start protecting your payroll today
        </h2>
        <p className="text-slate-400 mb-8 text-lg">
          Set up your ministry account in under 2 minutes. No IT team required. Works on any smartphone.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup"
            className="bg-emerald-600 hover:bg-emerald-700 transition px-10 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/30">
            Create Agency Account →
          </Link>
          <Link to="/signin"
            className="border border-white/15 hover:border-white/30 transition px-10 py-4 rounded-xl font-semibold text-lg text-slate-300 hover:text-white">
            Sign In
          </Link>
        </div>
        <p className="text-xs text-slate-600 mt-6">
          Payments powered by Squad API · Biometrics by MediaPipe FaceMesh · Built for Nigeria
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="PayGuard AI" className="h-6 w-auto opacity-50" />
            <span className="text-sm text-slate-600">PayGuard AI © 2026 — Fighting ghost worker fraud in Nigeria</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-600">
            <Link to="/signin" className="hover:text-white transition">Sign In</Link>
            <Link to="/signup" className="hover:text-white transition">Register Agency</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
