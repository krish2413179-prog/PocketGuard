'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '../../store/useAppStore';
import dynamic from 'next/dynamic';
import PageTransition from '../components/PageTransition';

const Antigravity = dynamic(() => import('../components/Antigravity'), { ssr: false });

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/permissions', label: 'Permissions' },
  { href: '/history', label: 'History' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { wallet, setWallet, disconnectWallet, child } = useAppStore();

  // Auto-connect to MetaMask if already authorized in the browser
  useEffect(() => {
    const checkConnectedAccounts = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
            
            // Switch to Arbitrum Sepolia if it's incorrect
            if (chainIdHex !== '0x66eee') {
              try {
                await window.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: '0x66eee' }]
                });
              } catch (e: any) {
                if (e.code === 4902) {
                  const { CONTRACTS } = await import('../../lib/contracts/addresses');
                  await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x66eee',
                      chainName: 'Arbitrum Sepolia',
                      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                      rpcUrls: [CONTRACTS.rpc],
                      blockExplorerUrls: [CONTRACTS.explorer]
                    }]
                  });
                }
              }
            }
            
            setWallet({
              isConnected: true,
              eoaAddress: accounts[0],
              smartAccountAddress: accounts[0],
              chainId: 421614
            });
          }
        } catch (err) {
          console.error('Failed to auto-reconnect wallet:', err);
        }
      }
    };

    checkConnectedAccounts();
  }, [setWallet]);

  // Listen for MetaMask account and chain changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccounts = (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setWallet({
          isConnected: true,
          eoaAddress: accounts[0],
          smartAccountAddress: accounts[0]
        });
      } else {
        // Disconnected
        setWallet({
          isConnected: false,
          eoaAddress: null,
          smartAccountAddress: null,
          chainId: null
        });
      }
    };

    const handleChain = (chainIdHex: string) => {
      const parsedChainId = parseInt(chainIdHex, 16);
      setWallet({ chainId: parsedChainId });
    };

    window.ethereum.on('accountsChanged', handleAccounts);
    window.ethereum.on('chainChanged', handleChain);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccounts);
        window.ethereum.removeListener('chainChanged', handleChain);
      }
    };
  }, [setWallet]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e2e8f0', position: 'relative' }}>

      {/* Particle background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <Antigravity
          count={300}
          magnetRadius={6}
          ringRadius={7}
          waveSpeed={0.4}
          waveAmplitude={1}
          particleSize={1.5}
          lerpSpeed={0.15}
          color="#5227ff"
          autoAnimate={true}
          particleVariance={1}
          rotationSpeed={0}
          depthFactor={1}
          pulseSpeed={3}
          particleShape="capsule"
          fieldStrength={10}
        />
      </div>

      {/* Top navigation bar */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: '3.25rem',
        background: 'rgba(10,10,10,0.8)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1.5rem',
      }}>
        {/* Left: logo + back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" style={{ fontSize: '0.7rem', color: '#52525b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            ← Home
          </Link>
          <div style={{ width: '1px', height: '1rem', background: '#27272a' }} />
          <Link href="/" style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem', letterSpacing: '-0.02em', textDecoration: 'none' }}>
            PocketGuard
          </Link>
        </div>

        {/* Center: nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.15s',
              background: pathname === item.href ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: pathname === item.href ? '#e2e8f0' : '#71717a',
              border: pathname === item.href ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            }}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right: wallet status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {child && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 500 }}>{child.name}</span>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '9999px',
                background: 'rgba(255,255,255,0.07)',
                color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.12)',
                letterSpacing: '0.02em',
              }}>
                {child.isPaused ? 'Paused' : 'Active'}
              </span>
            </div>
          )}
          {wallet.isConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontSize: '0.6875rem', fontFamily: 'monospace', color: '#a1a1aa',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                padding: '0.25rem 0.625rem', borderRadius: '0.375rem',
              }}>
                {wallet.eoaAddress?.slice(0, 6)}...{wallet.eoaAddress?.slice(-4)}
              </span>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700,
                background: 'rgba(255,255,255,0.07)', color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '0.25rem 0.75rem', borderRadius: '9999px',
                letterSpacing: '0.02em',
              }}>
                Arb Sepolia
              </span>
              <button
                onClick={disconnectWallet}
                style={{ fontSize: '0.6875rem', color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontWeight: 500 }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <Link href="/dashboard">
              <button style={{
                background: '#e2e8f0', color: '#0a0a0a',
                padding: '0.375rem 0.875rem', borderRadius: '0.5rem',
                fontSize: '0.8125rem', fontWeight: 600, border: 'none', cursor: 'pointer',
              }}>
                Connect wallet
              </button>
            </Link>
          )}
        </div>
      </header>

      {/* Page content */}
      <main style={{ position: 'relative', zIndex: 1, paddingTop: '3.25rem', minHeight: '100vh' }}>
        <PageTransition>
          {children}
        </PageTransition>
      </main>

    </div>
  );
}
