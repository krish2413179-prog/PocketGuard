'use client';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatEther, parseEther } from 'viem';
import { CONTRACTS } from '../../lib/contracts/addresses';
import type { PermissionGrant } from '../../types';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl ${className}`} style={{ background: 'rgba(17,17,17,0.75)', border: '1px solid #27272a', backdropFilter: 'blur(8px)' }}>{children}</div>;
}
function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: 'green' | 'red' | 'amber' | 'slate' | 'blue' }) {
  const s: Record<string, React.CSSProperties> = {
    green: { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' },
    red: { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' },
    amber: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' },
    slate: { background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: '1px solid #27272a' },
    blue: { background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: '1px solid #27272a' },
  };
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s[color]}>{children}</span>;
}

function PermCard({ p, isActive, onRevoke, onSelect }: { p: PermissionGrant; isActive: boolean; onRevoke: () => void; onSelect: () => void }) {
  const cap = BigInt(p.spendingCapWei), used = BigInt(p.usedAllowanceWei);
  const pct = cap > 0n ? Math.min(100, Number((used * 100n) / cap)) : 0;
  const expired = p.expiryTimestamp < Date.now() / 1000;
  return (
    <div className="rounded-xl p-5 cursor-pointer" style={{ background: '#111111', border: isActive ? '1px solid #52525b' : '1px solid #27272a' }} onClick={onSelect}>
      <div className="flex items-start justify-between mb-3">
        <div><div className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{p.description || 'Permission grant'}</div><div className="text-[10px] font-mono mt-0.5" style={{ color: '#52525b' }}>{p.permissionId.slice(0, 24)}...</div></div>
        <div className="flex gap-1.5 shrink-0">{isActive && <Badge color="blue">Active</Badge>}<Badge color={p.isRevoked ? 'red' : expired ? 'amber' : 'green'}>{p.isRevoked ? 'Revoked' : expired ? 'Expired' : 'Valid'}</Badge></div>
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-[10px]" style={{ color: '#71717a' }}><span>Used: {parseFloat(formatEther(used)).toFixed(5)} ETH</span><span>Cap: {parseFloat(formatEther(cap)).toFixed(5)} ETH</span></div>
        <div className="progress-track h-1.5"><div className="progress-fill" style={{ width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#e2e8f0' }} /></div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-4" style={{ color: '#71717a' }}>
        <span>Daily: {parseFloat(formatEther(BigInt(p.dailyLimitWei))).toFixed(5)} ETH</span>
        <span>Expires: {new Date(p.expiryTimestamp * 1000).toLocaleDateString()}</span>
        <span>Token: {p.tokenSymbol}</span>
        <span>Targets: {p.allowedTargets.length > 0 ? `${p.allowedTargets.length} addresses` : 'All'}</span>
      </div>
      {!p.isRevoked && (
        <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #18181b' }}>
          <button onClick={e => { e.stopPropagation(); onSelect(); }} className="flex-1 py-2 rounded-lg text-xs font-medium" style={isActive ? { background: '#e2e8f0', color: '#0a0a0a' } : { background: '#18181b', color: '#e2e8f0', border: '1px solid #27272a' }}>{isActive ? 'Selected' : 'Use this'}</button>
          <button onClick={e => { e.stopPropagation(); onRevoke(); }} className="px-3 py-2 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Revoke</button>
        </div>
      )}
    </div>
  );
}

const TOKENS = [{ symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' }, { symbol: 'USDC', address: CONTRACTS.USDC }, { symbol: 'WETH', address: CONTRACTS.WETH }];
const DURATIONS = [{ label: '1 hour', seconds: 3600 }, { label: '24 hours', seconds: 86400 }, { label: '7 days', seconds: 604800 }, { label: '30 days', seconds: 2592000 }];

export default function PermissionsPage() {
  const { wallet, permissions, activePermission, addPermission, revokePermission, setActivePermission } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ token: 'ETH', cap: '0.01', daily: '0.005', duration: 86400, description: 'PocketGuard permission', targets: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!wallet.isConnected || !wallet.smartAccountAddress) { setError('Connect wallet first'); return; }
    setCreating(true); setError(null);
    try {
      const capWei = parseEther(form.cap).toString(), dailyWei = parseEther(form.daily).toString(), expiry = Math.floor(Date.now() / 1000) + form.duration;
      if (!window.ethereum) throw new Error('MetaMask is not available');
      const r = await window.ethereum.request({
        method: 'wallet_grantPermissions',
        params: [{
          chainId: `0x${CONTRACTS.chainId.toString(16)}`,
          address: wallet.smartAccountAddress,
          expiry,
          signer: { type: 'account', data: { id: wallet.eoaAddress } },
          permissions: [{ type: 'native-token-transfer', data: { allowance: capWei }, required: true }]
        }]
      });
      const permissionContext = r?.[0]?.context;
      if (!permissionContext) throw new Error('Failed to obtain permission context from MetaMask.');
      const tokenInfo = TOKENS.find(t => t.symbol === form.token) || TOKENS[0];
      const targets = form.targets.trim() ? form.targets.split(',').map(t => t.trim()).filter(Boolean) : [];
      const grant: PermissionGrant = { permissionId: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, token: tokenInfo.address, tokenSymbol: form.token, spendingCapWei: capWei, dailyLimitWei: dailyWei, usedAllowanceWei: '0', expiryTimestamp: expiry, allowedTargets: targets, description: form.description, permissionContext, smartAccountAddress: wallet.smartAccountAddress, createdAt: Date.now(), isRevoked: false };
      await fetch('/api/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...grant }) });
      addPermission(grant); setActivePermission(grant); setShowModal(false);
    } catch (err: any) { setError(err.message || 'Failed'); } finally { setCreating(false); }
  };

  const handleRevoke = async (id: string) => { try { await fetch('/api/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke', permissionId: id }) }); } catch { /* */ } revokePermission(id); };
  const valid = permissions.filter(p => !p.isRevoked), revoked = permissions.filter(p => p.isRevoked);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>Permissions</h1><p className="text-sm mt-0.5" style={{ color: '#71717a' }}>ERC-7715 session key grants</p></div>
        {wallet.isConnected && <button onClick={() => { setShowModal(true); setError(null); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#e2e8f0', color: '#0a0a0a' }}>New permission</button>}
      </div>

      {!wallet.isConnected && <Card className="p-10 text-center"><p className="text-sm" style={{ color: '#71717a' }}>Connect your wallet to manage permissions.</p></Card>}

      {valid.length > 0 && <div><div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#52525b' }}>Active ({valid.length})</div><div className="grid md:grid-cols-2 gap-4">{valid.map(p => <PermCard key={p.permissionId} p={p} isActive={activePermission?.permissionId === p.permissionId} onRevoke={() => handleRevoke(p.permissionId)} onSelect={() => setActivePermission(p)} />)}</div></div>}

      {revoked.length > 0 && <div><div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#52525b' }}>Revoked ({revoked.length})</div><div className="grid md:grid-cols-2 gap-4 opacity-50">{revoked.map(p => <PermCard key={p.permissionId} p={p} isActive={false} onRevoke={() => {}} onSelect={() => {}} />)}</div></div>}

      {permissions.length === 0 && wallet.isConnected && <Card className="p-12 text-center"><p className="text-sm mb-4" style={{ color: '#71717a' }}>No permissions yet.</p><button onClick={() => setShowModal(true)} className="px-6 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#e2e8f0', color: '#0a0a0a' }}>Grant first permission</button></Card>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4" style={{ background: '#111111', border: '1px solid #27272a' }}>
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>New permission</h2><button onClick={() => setShowModal(false)} className="text-sm" style={{ color: '#52525b' }}>Close</button></div>
            <div><div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#52525b' }}>Token</div><div className="flex gap-2">{TOKENS.map(t => <button key={t.symbol} onClick={() => setForm(f => ({ ...f, token: t.symbol }))} className="flex-1 py-2 rounded-lg text-xs font-medium" style={form.token === t.symbol ? { background: '#e2e8f0', color: '#0a0a0a' } : { background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>{t.symbol}</button>)}</div></div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#52525b' }}>Spending cap (ETH)</div><input type="number" value={form.cap} onChange={e => setForm(f => ({ ...f, cap: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#0a0a0a', border: '1px solid #27272a', color: '#e2e8f0' }} /></div>
              <div><div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#52525b' }}>Daily limit (ETH)</div><input type="number" value={form.daily} onChange={e => setForm(f => ({ ...f, daily: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#0a0a0a', border: '1px solid #27272a', color: '#e2e8f0' }} /></div>
            </div>
            <div><div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#52525b' }}>Duration</div><div className="flex gap-2">{DURATIONS.map(d => <button key={d.label} onClick={() => setForm(f => ({ ...f, duration: d.seconds }))} className="flex-1 py-2 rounded-lg text-xs font-medium" style={form.duration === d.seconds ? { background: '#e2e8f0', color: '#0a0a0a' } : { background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>{d.label}</button>)}</div></div>
            <div><div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#52525b' }}>Description</div><input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#0a0a0a', border: '1px solid #27272a', color: '#e2e8f0' }} /></div>
            {error && <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>{error}</div>}
            <button onClick={handleCreate} disabled={creating} className="w-full py-3 rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: '#e2e8f0', color: '#0a0a0a' }}>{creating ? 'Requesting via ERC-7715...' : 'Grant permission'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
