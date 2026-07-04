import { Link } from "react-router";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="PayGuard AI" className="h-9 w-auto" />
          <span className="text-xl font-bold tracking-tight">PayGuard AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/signin" className="text-sm text-slate-300 hover:text-white transition px-4 py-2">
            Sign in
          </Link>
          <Link to="/signup" className="text-sm bg-emerald-600 hover:bg-emerald-700 transition px-4 py-2 rounded-lg font-semibold">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase">
          Built for Nigerian Government Payroll
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Ghost workers don't blink.
          <br />
          <span className="text-emerald-400">Real ones do.</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          PayGuard AI stops salary fraud before it happens. Every staff member completes a live biometric challenge on their phone before their salary is released. No face. No blink. No payment.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup"
            className="bg-emerald-600 hover:bg-emerald-700 transition px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/40">
            Create Agency Account →
          </Link>
          <Link to="/signin"
            className="border border-white/20 hover:border-white/40 transition px-8 py-4 rounded-xl font-semibold text-lg text-slate-300 hover:text-white">
            Sign In
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { value: "₦200B+", label: "Lost to ghost workers annually in Nigeria" },
            { value: "3 challenges", label: "Randomised biometric challenges per verification" },
            { value: "< 30 seconds", label: "Average verification time on any smartphone" },
          ].map(({ value, label }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <div className="text-3xl font-extrabold text-emerald-400 mb-2">{value}</div>
              <div className="text-sm text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: "01", icon: "📋", title: "Upload Staff", desc: "HR uploads staff records and photos via CSV or manually." },
            { step: "02", icon: "📱", title: "Send Link", desc: "Each worker gets a one-time verification link via email." },
            { step: "03", icon: "👁️", title: "Biometric Check", desc: "Worker completes live challenges — blink, smile, head turn — on their phone." },
            { step: "04", icon: "💰", title: "Pay Verified Staff", desc: "HR approves the payment batch. Salaries go only to verified faces." },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="relative">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full">
                <div className="text-xs text-emerald-500 font-bold mb-3 tracking-widest">{step}</div>
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security features */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Built to Block Fraud</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: "🔐", title: "HMAC-signed challenge nonces", desc: "API bypass is impossible — every session requires a server-issued cryptographic proof." },
            { icon: "🎲", title: "Unpredictable challenge order", desc: "Crypto-random sequence each session. Pre-recorded videos can't pass." },
            { icon: "🏦", title: "Bank account name check", desc: "Squad API verifies account name matches staff name before every transfer." },
            { icon: "📊", title: "Full audit trail", desc: "Every verification attempt, approval, and payment is logged with timestamps." },
            { icon: "🛡️", title: "Server-side score computation", desc: "Client-supplied trust scores are ignored. Backend always recomputes from raw data." },
            { icon: "📵", title: "Hardware camera lock", desc: "Virtual cameras (OBS, DroidCam) are detected and blocked." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="text-2xl shrink-0">{icon}</div>
              <div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-slate-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-extrabold mb-4">Ready to stop ghost workers?</h2>
        <p className="text-slate-400 mb-8">Create your ministry account in under 2 minutes. No credit card required.</p>
        <Link to="/signup"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 transition px-10 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/40">
          Create Agency Account →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="PayGuard AI" className="h-6 w-auto opacity-60" />
            <span className="text-sm text-slate-500">PayGuard AI © 2026</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/signin" className="hover:text-white transition">Sign In</Link>
            <Link to="/signup" className="hover:text-white transition">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
