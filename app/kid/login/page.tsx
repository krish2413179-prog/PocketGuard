'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '../../../store/useAppStore';

/**
 * Kid Login — server-only authentication.
 * Fetches child config from /api/family using parent address + PIN.
 * Works from any device as long as the parent dashboard has been opened
 * at least once after setup (which triggers the auto-sync to the server).
 */
export default function KidLoginPage() {
  const router = useRouter();
  const { setChild, addPermission, permissions, setPendingRequests, setTransactions } = useAppStore();

  const [parentAddr, setParentAddr] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    const addr = parentAddr.trim();
    if (!addr || addr.length < 10) { setError('Please enter a valid parent wallet address.'); return; }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) { setError('PIN must be exactly 6 digits.'); return; }

    setLoading(true);

    try {
      const res = await fetch(
        `/api/family?parentAddress=${encodeURIComponent(addr)}&pin=${encodeURIComponent(pin)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Incorrect address or PIN. Open the parent dashboard first to sync the data, then try again.');
        setLoading(false);
        return;
      }

      const { config } = data;

      // Load into local store
      setChild(config);
      if (config.permissions?.length && permissions.length === 0) {
        config.permissions.forEach((p: any) => addPermission(p));
      }
      if (config.pendingRequests) {
        setPendingRequests(config.pendingRequests);
      }
      if (config.transactions) {
        setTransactions(config.transactions);
      }

      router.push('/kid');
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '26rem' }}>

        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#52525b', textDecoration: 'none', marginBottom: '2rem' }}>
          ← Back
        </Link>

        <div style={{ background: 'rgba(17,17,17,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem', padding: '2rem', backdropFilter: 'blur(12px)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.375rem' }}>
              Kid wallet access
            </h1>
            <p style={{ fontSize: '0.8125rem', color: '#71717a', lineHeight: 1.5 }}>
              Enter your parent's wallet address and the family PIN shown on their dashboard.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Parent wallet address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={parentAddr}
                onChange={e => setParentAddr(e.target.value)}
                style={{ width: '100%', background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#e2e8f0', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Family PIN
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ width: '100%', background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontSize: '1.5rem', color: '#e2e8f0', fontFamily: 'monospace', outline: 'none', letterSpacing: '0.4em', textAlign: 'center', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '0.6875rem', color: '#3f3f46', marginTop: '0.375rem' }}>
                Find the 6-digit PIN in the parent dashboard wallet card.
              </p>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#ef4444', lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || pin.length !== 6 || parentAddr.length < 10}
              style={{ width: '100%', background: '#e2e8f0', color: '#0a0a0a', border: 'none', borderRadius: '0.5rem', padding: '0.875rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: (loading || pin.length !== 6 || parentAddr.length < 10) ? 0.4 : 1, transition: 'opacity 0.15s' }}
            >
              {loading ? 'Verifying...' : 'Enter wallet'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem', color: '#52525b' }}>
          Are you a parent?{' '}
          <Link href="/dashboard" style={{ color: '#a1a1aa', textDecoration: 'none' }}>
            Open parent dashboard →
          </Link>
        </p>
      </div>
    </div>
  );
}
