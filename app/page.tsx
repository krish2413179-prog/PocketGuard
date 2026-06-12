'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const LightRays = dynamic(() => import('./components/LightRays'), { ssr: false });

const FEATURES = [
  { title: 'Smart Account Wallet', desc: 'Every child gets an ERC-4337 smart account. Rules are enforced at the contract level — not in the app.' },
  { title: 'Session Key Permissions', desc: 'Parent signs once via ERC-7715. The child spends freely within the defined limits. No manual approval per transaction.' },
  { title: 'Gasless Transactions', desc: 'Every child transaction is relayed for free via the 1Shot API. No ETH required in the child wallet.' },
  { title: 'AI Spending Advisor', desc: "Venice AI analyzes spending patterns and suggests allowance adjustments based on the child's behavior." },
  { title: 'Wallet-Level Protection', desc: 'The MetaMask Snap intercepts transactions on any website — not just PocketGuard. Betting sites are blocked everywhere.' },
  { title: 'Parent Approval Queue', desc: 'When spending exceeds limits or targets unlisted addresses, the child requests approval. Parent approves or rejects in one tap.' },
];

const STEPS = [
  { step: '01', title: 'Connect parent wallet', desc: 'Sign in with MetaMask. Auto-switches to Arbitrum Sepolia.' },
  { step: '02', title: 'Create child account', desc: 'Name the child, set daily and weekly limits. A Smart Account is derived from your wallet.' },
  { step: '03', title: 'Grant permissions', desc: 'Sign an ERC-7715 session key. The child can spend within your rules, gaslessly.' },
  { step: '04', title: 'Monitor and adjust', desc: 'Venice AI surfaces insights. Add or remove allowed addresses any time.' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e2e8f0' }}>

      {/* Full-page LightRays — fixed behind everything */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <LightRays
          raysOrigin="top-center"
          raysColor="#818cf8"
          raysSpeed={1.0}
          lightSpread={1.4}
          rayLength={1.8}
          followMouse={true}
          mouseInfluence={0.25}
          pulsating={true}
          fadeDistance={1.5}
          saturation={1.8}
          noiseAmount={0.04}
          distortion={0.02}
        />
      </div>

      {/* All content above rays */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Nav */}
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(10,10,10,0.8)', borderBottom: '1px solid #18181b', backdropFilter: 'blur(12px)' }}>
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <span style={{ fontWeight: 600, color: '#e2e8f0', letterSpacing: '-0.02em' }}>PocketGuard</span>
            <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: '#71717a' }}>
              <a href="#how-it-works" style={{ color: '#71717a', textDecoration: 'none' }}>How it works</a>
              <a href="#features" style={{ color: '#71717a', textDecoration: 'none' }}>Features</a>
              <a href="https://sepolia.arbiscan.io" target="_blank" rel="noopener noreferrer" style={{ color: '#71717a', textDecoration: 'none' }}>Arbitrum Sepolia</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/kid/login">
                <button style={{ fontSize: '0.875rem', color: '#a1a1aa', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Kid view
                </button>
              </Link>
              <Link href="/dashboard">
                <button style={{ background: '#e2e8f0', color: '#0a0a0a', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  Parent dashboard
                </button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="text-center" style={{ paddingTop: '8rem', paddingBottom: '6rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', maxWidth: '56rem', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #27272a', color: '#71717a', padding: '0.375rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500, marginBottom: '2rem' }}>
            Built on Arbitrum Sepolia — testnet only
          </div>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, color: '#f4f4f5', marginBottom: '1.5rem' }}>
            Your child's first<br />crypto wallet.
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#71717a', maxWidth: '36rem', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Set spending limits, whitelist approved addresses, and block gambling sites.
            Rules are enforced on-chain — not in the app.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard">
              <button style={{ background: '#e2e8f0', color: '#0a0a0a', padding: '0.875rem 2rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', width: '100%' }}>
                Parent dashboard
              </button>
            </Link>
            <Link href="/kid/login">
              <button style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', padding: '0.875rem 2rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600, border: '1px solid #27272a', cursor: 'pointer', width: '100%' }}>
                Kid wallet access
              </button>
            </Link>
          </div>
        </section>

        {/* Stack badges */}
        <section style={{ padding: '2rem 1.5rem', borderTop: '1px solid #18181b', borderBottom: '1px solid #18181b', background: 'rgba(255,255,255,0.02)' }}>
          <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-3">
            {['ERC-4337 Smart Accounts', 'ERC-7715 Session Keys', 'ERC-7710 via 1Shot', 'Venice AI x402', 'MetaMask Snap', 'Arbitrum Sepolia'].map((tag) => (
              <span key={tag} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #27272a', color: '#71717a', fontSize: '0.75rem', fontWeight: 500, padding: '0.375rem 0.75rem', borderRadius: '9999px' }}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" style={{ padding: '6rem 1.5rem', maxWidth: '64rem', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f5', textAlign: 'center', marginBottom: '3rem' }}>How it works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.step} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#3f3f46' }}>{s.step}</div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{s.title}</h3>
                <p style={{ fontSize: '0.875rem', color: '#71717a', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" style={{ padding: '6rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid #18181b' }}>
          <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f5', textAlign: 'center', marginBottom: '3rem' }}>Features</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div key={f.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #18181b', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{f.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: '#71717a', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" style={{ padding: '6rem 1.5rem', textAlign: 'center', maxWidth: '36rem', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f5', marginBottom: '1rem' }}>Ready to get started?</h2>
          <p style={{ color: '#71717a', marginBottom: '2rem', fontSize: '0.875rem' }}>Connect your MetaMask wallet and set up your child's account in under two minutes.</p>
          <Link href="/dashboard">
            <button style={{ background: '#e2e8f0', color: '#0a0a0a', padding: '0.875rem 2rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Open parent dashboard
            </button>
          </Link>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid #18181b', padding: '2rem 1.5rem' }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4" style={{ fontSize: '0.75rem', color: '#3f3f46' }}>
            <span>PocketGuard — Arbitrum Sepolia testnet. No real funds.</span>
            <span>MetaMask Smart Accounts · 1Shot Relayer · Venice AI</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
