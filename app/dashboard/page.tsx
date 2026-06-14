'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAppStore, type ApprovalRequest } from '../../store/useAppStore';
import { formatEther, parseEther } from 'viem';
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { CONTRACTS } from '../../lib/contracts/addresses';
import { relayTransaction } from '../../lib/oneshot/relayer';
import { syncBlacklistToSnap, getSnapStatus, installSnap, type SnapInstallStatus } from '../../lib/snap/install';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(CONTRACTS.rpc) });

const BETTING_PRESETS = [
  { name: 'Polymarket', address: '0x4DE23f3f0Fb3318287378AdbdE030cf61714b2f3' },
  { name: 'Shuffle Gaming', address: '0xdA7320DDEBE7964bA029472e38E75C417A2A9448' },
  { name: 'Sepolia Betting', address: '0x9999999999999999999999999999999999999999' },
];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl ${className}`} style={{ background: 'rgba(17,17,17,0.75)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#52525b' }}>{children}</div>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors" style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' }} />;
}
// Badge imported from components/ui/badge

export default function DashboardPage() {
  const { wallet, setWallet, child, setChild, updateChild, permissions, addPermission, revokePermission, transactions, addTransaction, pendingRequests, updatePendingRequest, setPendingRequests, setTransactions } = useAppStore();
  const [balance, setBalance] = useState('0');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState(3000);
  const [childName, setChildName] = useState('');
  const [weeklyAllowance, setWeeklyAllowance] = useState('10');
  const [dailyLimit, setDailyLimit] = useState('3');
  const [newWhitelistAddr, setNewWhitelistAddr] = useState('');
  const [newBlacklistAddr, setNewBlacklistAddr] = useState('');
  const [insights, setInsights] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [alerts, setAlerts] = useState('');
  const [loadingAdvisor, setLoadingAdvisor] = useState(false);
  const [x402Meta, setX402Meta] = useState<{ usedX402: boolean; walletAddress?: string; balanceRemaining?: string } | null>(null);
  const [snapStatus, setSnapStatus] = useState<SnapInstallStatus>('not_installed');
  const [snapInstalling, setSnapInstalling] = useState(false);
  const [snapSyncing, setSnapSyncing] = useState(false);
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      .then(r => r.json()).then(d => { if (d.ethereum?.usd) setEthPrice(d.ethereum.usd); }).catch(() => {});
    getSnapStatus().then(setSnapStatus);
  }, []);

  // ── Server sync ────────────────────────────────────────────────────────────
  // Every time child config changes, push the latest state to /api/family
  // so the kid can authenticate from any device using parent address + PIN.
  // NOTE: We deliberately do NOT send pendingRequests here — they are managed
  // server-side via append-request (child) and update (parent approve/reject).
  // Sending them here would overwrite requests the child just submitted.
  const syncFamilyToServer = useCallback(async (childData: typeof child, permsData: typeof permissions, txs: typeof transactions) => {
    if (!childData?.familyPin) return;
    // Use parentAddress from child record, fall back to currently connected wallet
    const parentAddr = childData.parentAddress || wallet.eoaAddress;
    if (!parentAddr) return;
    try {
      await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          parentAddress: parentAddr,
          familyPin: childData.familyPin,
          childConfig: { ...childData, parentAddress: parentAddr },
          permissions: permsData,
          transactions: txs,
          // pendingRequests intentionally omitted — server merges from existing
        }),
      });
    } catch { /* non-critical */ }
  }, [wallet.eoaAddress]);

  // Auto-sync whenever child, permissions, or transactions change
  useEffect(() => {
    if (child?.familyPin && child?.parentAddress) {
      syncFamilyToServer(child, permissions, transactions);
    }
  }, [child, permissions, transactions, syncFamilyToServer]);

  // Poll/fetch family config from server to get new pending requests/transactions from kid
  useEffect(() => {
    if (!wallet.isConnected || !child?.familyPin || !child?.parentAddress) return;

    const fetchFamilyConfig = async () => {
      try {
        const res = await fetch(`/api/family?parentAddress=${encodeURIComponent(child.parentAddress!)}&pin=${encodeURIComponent(child.familyPin!)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            // Update local store with any new/updated pending requests or transactions from server
            if (data.config.pendingRequests) {
              setPendingRequests(data.config.pendingRequests);
            }
            if (data.config.transactions) {
              setTransactions(data.config.transactions);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch family config:', err);
      }
    };

    fetchFamilyConfig();
    const interval = setInterval(fetchFamilyConfig, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [wallet.isConnected, child?.familyPin, child?.parentAddress, setPendingRequests, setTransactions]);

  const fetchBalance = useCallback(async (addr: string) => {
    try { const bal = await publicClient.getBalance({ address: addr as `0x${string}` }); setBalance(parseFloat(formatEther(bal)).toFixed(4)); }
    catch { setBalance('0'); }
  }, []);

  useEffect(() => { if (child?.smartAccountAddress) fetchBalance(child.smartAccountAddress); }, [child?.smartAccountAddress, fetchBalance]);

  const connectWallet = async () => {
    setConnecting(true); setError(null);
    try {
      if (!window.ethereum) throw new Error('MetaMask not found. Please install MetaMask.');

      // Force a fresh connection popup by revoking existing permissions first
      try {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch { /* wallet_revokePermissions may not be supported in all versions — ignore */ }

      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts[0]) throw new Error('No account returned');
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x66eee') {
        try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x66eee' }] }); }
        catch (e: any) { if (e.code === 4902) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x66eee', chainName: 'Arbitrum Sepolia', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: [CONTRACTS.rpc], blockExplorerUrls: [CONTRACTS.explorer] }] }); }
      }
      setWallet({ isConnected: true, eoaAddress: accounts[0], smartAccountAddress: accounts[0], chainId: 421614 });
    } catch (err: any) { setError(err.message || 'Connection failed'); }
    finally { setConnecting(false); }
  };

  const handleAddChild = async () => {
    if (!wallet.isConnected || !childName.trim()) return;
    try {
      const wc = createWalletClient({ account: wallet.eoaAddress as `0x${string}`, chain: arbitrumSepolia, transport: custom(window.ethereum) });
      const { getOrCreateSmartAccount } = await import('../../lib/metamask/smartAccount');
      const sa = await getOrCreateSmartAccount(wallet.eoaAddress!, wc);
      const newChild = { name: childName.trim(), smartAccountAddress: sa.address, weeklyAllowanceUSD: parseFloat(weeklyAllowance), dailyLimitUSD: parseFloat(dailyLimit), whitelist: [CONTRACTS.WETH, CONTRACTS.USDC], blacklist: [BETTING_PRESETS[0].address, BETTING_PRESETS[1].address], isPaused: false, savingsGoalName: 'First savings goal', savingsGoalUSD: 50, savingsProgressUSD: 0, familyPin: Math.floor(100000 + Math.random() * 900000).toString(), parentAddress: wallet.eoaAddress! };
      setChild(newChild);
      const capWei = parseEther((newChild.weeklyAllowanceUSD / ethPrice).toFixed(6)).toString();
      const dailyWei = parseEther((newChild.dailyLimitUSD / ethPrice).toFixed(6)).toString();
      const expiry = Math.floor(Date.now() / 1000) + 604800;
      let permissionContext = `0xdemo_${Date.now().toString(16)}`;
      try { const r = await window.ethereum.request({ method: 'wallet_grantPermissions', params: [{ chainId: `0x${CONTRACTS.chainId.toString(16)}`, address: sa.address, expiry, signer: { type: 'account', data: { id: wallet.eoaAddress } }, permissions: [{ type: 'native-token-transfer', data: { allowance: capWei }, required: true }] }] }); permissionContext = r?.[0]?.context || permissionContext; } catch { /* demo */ }
      const newPerm = { permissionId: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, token: '0x0000000000000000000000000000000000000000', tokenSymbol: 'ETH', spendingCapWei: capWei, dailyLimitWei: dailyWei, usedAllowanceWei: '0', expiryTimestamp: expiry, allowedTargets: newChild.whitelist, description: `PocketGuard — ${newChild.name}`, permissionContext, smartAccountAddress: sa.address, createdAt: Date.now(), isRevoked: false };
      addPermission(newPerm);
      // Save to family API — kid can now access from any device using parent address + PIN
      try {
        await fetch('/api/family', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', parentAddress: wallet.eoaAddress, familyPin: newChild.familyPin, childConfig: newChild, permissions: [newPerm], transactions: [] }) });
      } catch { /* non-critical — local state is primary */ }
      await fetchBalance(sa.address); setChildName('');
    } catch (err: any) { setError(err.message || 'Failed to create child account'); }
  };

  const handleTogglePause = () => {
    if (!child) return;
    const next = !child.isPaused; updateChild({ isPaused: next });
    if (next) { permissions.forEach(p => { if (!p.isRevoked) revokePermission(p.permissionId); }); }
    else { const capWei = parseEther((child.weeklyAllowanceUSD / ethPrice).toFixed(6)).toString(); const dailyWei = parseEther((child.dailyLimitUSD / ethPrice).toFixed(6)).toString(); addPermission({ permissionId: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, token: '0x0000000000000000000000000000000000000000', tokenSymbol: 'ETH', spendingCapWei: capWei, dailyLimitWei: dailyWei, usedAllowanceWei: '0', expiryTimestamp: Math.floor(Date.now() / 1000) + 604800, allowedTargets: child.whitelist, description: `PocketGuard — ${child.name}`, permissionContext: `0xdemo_${Date.now().toString(16)}`, smartAccountAddress: child.smartAccountAddress, createdAt: Date.now(), isRevoked: false }); }
  };

  const handleFundChild = async () => {
    if (!wallet.isConnected || !child || !window.ethereum) return;
    setFunding(true);
    try {
      const wc = createWalletClient({
        account: wallet.eoaAddress as `0x${string}`,
        chain: arbitrumSepolia,
        transport: custom(window.ethereum)
      });
      const hash = await wc.sendTransaction({
        to: child.smartAccountAddress as `0x${string}`,
        value: parseEther('0.01'),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchBalance(child.smartAccountAddress);
      alert('Successfully funded child wallet with 0.01 ETH!');
    } catch (err: any) {
      alert(err.message || 'Funding failed');
    } finally {
      setFunding(false);
    }
  };

  const handleAddWhitelist = () => { if (!child || !newWhitelistAddr.trim()) return; updateChild({ whitelist: [...child.whitelist, newWhitelistAddr.trim()] }); setNewWhitelistAddr(''); };
  const handleAddBlacklist = (address: string) => { if (!child || !address.trim() || child.blacklist.includes(address.trim())) return; const updated = [...child.blacklist, address.trim()]; updateChild({ blacklist: updated }); syncBlacklistToSnap(updated); setNewBlacklistAddr(''); };
  const handleRemoveBlacklist = (address: string) => { if (!child) return; const updated = child.blacklist.filter(a => a !== address); updateChild({ blacklist: updated }); syncBlacklistToSnap(updated); };

  const handleApproveRequest = async (req: ApprovalRequest) => {
    if (!child) return;
    try {
      updatePendingRequest(req.id, 'approved');
      const updatedRequests = pendingRequests.map(r => r.id === req.id ? { ...r, status: 'approved' as const } : r);
      await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          parentAddress: child.parentAddress,
          familyPin: child.familyPin,
          updates: { pendingRequests: updatedRequests }
        })
      });
    } catch (err: any) {
      alert(err.message || 'Failed to approve request');
    }
  };

  const handleRejectRequest = async (req: ApprovalRequest) => {
    if (!child) return;
    try {
      updatePendingRequest(req.id, 'rejected');
      const updatedRequests = pendingRequests.map(r => r.id === req.id ? { ...r, status: 'rejected' as const } : r);
      await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          parentAddress: child.parentAddress,
          familyPin: child.familyPin,
          updates: { pendingRequests: updatedRequests }
        })
      });
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    }
  };

  const fetchAdvisor = useCallback(async () => {
    if (!child) return; setLoadingAdvisor(true);
    try {
      const res = await fetch('/api/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ childName: child.name, limits: { weeklyAllowanceUSD: child.weeklyAllowanceUSD, dailyLimitUSD: child.dailyLimitUSD }, transactions: transactions.filter(t => t.smartAccountAddress === child.smartAccountAddress) }) });
      const data = await res.json();
      if (data.insights) setInsights(data.insights); if (data.suggestions) setSuggestions(data.suggestions); if (data.alerts) setAlerts(data.alerts); if (data.x402) setX402Meta(data.x402);
    } catch { setInsights('Could not load advisor.'); } finally { setLoadingAdvisor(false); }
  }, [child, transactions]);

  useEffect(() => { if (child) fetchAdvisor(); }, [child, fetchAdvisor]);

  const handleInstallSnap = async () => { setSnapInstalling(true); try { await installSnap(); setSnapStatus('installed'); if (child) syncBlacklistToSnap(child.blacklist); } catch (e: any) { console.error(e.message); } finally { setSnapInstalling(false); } };

  const childTxs = child ? transactions.filter(t => t.smartAccountAddress === child.smartAccountAddress) : [];
  const pendingQueue = pendingRequests.filter(r => r.status === 'pending');
  const balanceUSD = (parseFloat(balance) * ethPrice).toFixed(2);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>Parent dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717a' }}>Manage your child's spending rules and wallet</p>
        </div>
        {wallet.isConnected && <Badge variant="outline" className="font-bold text-white/80 border-white/15">Connected to Arb Sepolia</Badge>}
      </div>

      {!wallet.isConnected && (
        <Card className="p-12 text-center max-w-md mx-auto">
          <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>Connect your wallet</h2>
          <p className="text-sm mb-6" style={{ color: '#71717a' }}>Connect MetaMask to create your child's smart account and set spending rules.</p>
          {error && <div className="text-sm rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>{error}</div>}
          <Button onClick={connectWallet} disabled={connecting} className="w-full py-3">{connecting ? 'Connecting...' : 'Connect MetaMask'}</Button>
        </Card>
      )}

      {wallet.isConnected && !child && (
        <Card className="p-6 max-w-md mx-auto space-y-4">
          <h2 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>Set up child account</h2>
          <div><Label>Child's name</Label><Input placeholder="e.g. Alex" value={childName} onChange={e => setChildName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Weekly allowance (USD)</Label><Input type="number" value={weeklyAllowance} onChange={e => setWeeklyAllowance(e.target.value)} /></div>
            <div><Label>Daily limit (USD)</Label><Input type="number" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} /></div>
          </div>
          {error && <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>{error}</div>}
          <Button onClick={handleAddChild} disabled={!childName.trim()} className="w-full py-2.5">Create child wallet</Button>
        </Card>
      )}

      {wallet.isConnected && child && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{child.name}'s wallet</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#52525b' }}>{child.smartAccountAddress.slice(0, 20)}...</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleFundChild} size="sm" disabled={funding}>
                    {funding ? 'Funding...' : 'Fund 0.01 ETH'}
                  </Button>
                  <Button variant={child.isPaused ? 'secondary' : 'destructive'} onClick={handleTogglePause} size="sm">{child.isPaused ? 'Resume wallet' : 'Pause wallet'}</Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: '1px solid #18181b' }}>
                <div><div className="text-xs mb-1" style={{ color: '#52525b' }}>Balance</div><div className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>${balanceUSD}</div><div className="text-xs" style={{ color: '#52525b' }}>{balance} ETH</div></div>
                <div><div className="text-xs mb-1" style={{ color: '#52525b' }}>Weekly allowance</div><div className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>${child.weeklyAllowanceUSD}</div></div>
                <div><div className="text-xs mb-1" style={{ color: '#52525b' }}>Daily limit</div><div className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>${child.dailyLimitUSD}</div></div>
              </div>
              {/* Family PIN — always visible, auto-generated if missing */}
              {(() => {
                let pin = child.familyPin;
                if (!pin) {
                  pin = Math.floor(100000 + Math.random() * 900000).toString();
                  const parentAddr = wallet.eoaAddress || '';
                  // Save pin + parentAddress to store — the useEffect will sync to server
                  updateChild({ familyPin: pin, parentAddress: parentAddr });
                }
                return (
                  <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div className="text-xs font-semibold mb-1" style={{ color: '#71717a' }}>Kid access PIN</div>
                      <div className="text-xs" style={{ color: '#52525b' }}>Share with {child.name} to log in from any device</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-2xl font-black px-5 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', letterSpacing: '0.35em' }}>
                        {pin}
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(pin!)}>Copy</Button>
                    </div>
                  </div>
                );
              })()}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>Pending approvals</h3>
                {pendingQueue.length > 0 && <Badge variant="warning">{pendingQueue.length} waiting</Badge>}
              </div>
              {pendingQueue.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: '#52525b' }}>No pending requests from {child.name}.</p>
              ) : (
                <div className="space-y-2">
                  {pendingQueue.map(req => (
                    <div key={req.id} className="flex items-center justify-between rounded-lg p-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{req.description}</div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: '#52525b' }}>to: {req.to.slice(0, 20)}...</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => handleApproveRequest(req)}>Approve</Button>
                        <Button variant="outline" size="sm" onClick={() => handleRejectRequest(req)}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#e2e8f0' }}>Approved addresses</h3>
                <p className="text-xs mb-4" style={{ color: '#52525b' }}>Child can spend freely at these addresses.</p>
                <div className="space-y-1.5 mb-3">
                  {child.whitelist.map((addr, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)' }}>
                      <span className="text-[10px] font-mono truncate" style={{ color: '#22c55e' }}>{addr === CONTRACTS.WETH ? 'WETH (Uniswap)' : addr === CONTRACTS.USDC ? 'USDC (Uniswap)' : addr.slice(0, 18) + '...'}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2"><Input placeholder="0x..." value={newWhitelistAddr} onChange={e => setNewWhitelistAddr(e.target.value)} /><Button variant="secondary" size="sm" onClick={handleAddWhitelist} className="shrink-0">Add</Button></div>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#e2e8f0' }}>Blocked addresses</h3>
                <p className="text-xs mb-3" style={{ color: '#52525b' }}>Transactions to these are hard-blocked.</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {BETTING_PRESETS.map(p => (
                    <Button key={p.address} variant="outline" size="xs" onClick={() => handleAddBlacklist(p.address)}>
                      + {p.name}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1.5 mb-3">
                  {child.blacklist.map((addr, i) => { const preset = BETTING_PRESETS.find(p => p.address.toLowerCase() === addr.toLowerCase()); return (<div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}><span className="text-[10px] font-mono truncate" style={{ color: '#ef4444' }}>{preset ? preset.name : addr.slice(0, 18) + '...'}</span><Button variant="ghost" size="xs" onClick={() => handleRemoveBlacklist(addr)}>Remove</Button></div>); })}
                </div>
                <div className="flex gap-2"><Input placeholder="0x..." value={newBlacklistAddr} onChange={e => setNewBlacklistAddr(e.target.value)} /><Button variant="destructive" size="sm" onClick={() => handleAddBlacklist(newBlacklistAddr)} className="shrink-0">Block</Button></div>
              </Card>
            </div>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>Transaction feed</h3>
              {childTxs.length === 0 ? (<p className="text-sm text-center py-4" style={{ color: '#52525b' }}>No transactions yet.</p>) : (
                <div className="space-y-2">
                  {childTxs.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2.5 last:border-0" style={{ borderBottom: '1px solid #18181b' }}>
                      <div><div className="text-sm" style={{ color: '#e2e8f0' }}>{tx.description}</div><div className="text-[10px] font-mono mt-0.5" style={{ color: '#52525b' }}>{tx.txHash ? tx.txHash.slice(0, 14) + '...' : 'pending'}</div></div>
                      <Badge variant={tx.status === 'success' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}>{tx.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>AI Advisor</h3>
                <div className="flex items-center gap-2">
                  {x402Meta && <Badge variant={x402Meta.usedX402 ? 'success' : 'info'}>{x402Meta.usedX402 ? 'x402 paid' : 'API key'}</Badge>}
                  <Badge variant="info">Venice AI</Badge>
                </div>
              </div>
              <div className="space-y-3">
                {[{ label: 'Insights', value: insights }, { label: 'Suggestions', value: suggestions }, { label: 'Alerts', value: alerts }].map(({ label, value }) => (
                  <div key={label}><div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#52525b' }}>{label}</div><p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>{value || '—'}</p></div>
                ))}
                {x402Meta?.usedX402 && x402Meta.walletAddress && (
                  <div className="pt-2 text-[10px] font-mono" style={{ borderTop: '1px solid #18181b', color: '#52525b' }}>Paid from: {x402Meta.walletAddress.slice(0, 18)}...{x402Meta.balanceRemaining && <span className="ml-2">Balance: ${x402Meta.balanceRemaining}</span>}</div>
                )}
              </div>
              <Button variant="secondary" onClick={fetchAdvisor} disabled={loadingAdvisor} className="w-full mt-4 text-xs">{loadingAdvisor ? 'Loading...' : 'Refresh analysis'}</Button>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-1" style={{ color: '#e2e8f0' }}>Safety Snap</h3>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: '#71717a' }}>Blocks gambling and betting transactions directly inside MetaMask — on any website, not just PocketGuard.</p>
              {snapStatus === 'installed' ? (
                <div className="space-y-3">
                  <Badge variant="outline" className="font-bold text-white/80 border-white/15">Active</Badge>
                  <p className="text-xs" style={{ color: '#71717a' }}>Blacklist syncs automatically when you add or remove addresses.</p>
                  <Button variant="secondary" onClick={async () => { setSnapSyncing(true); await syncBlacklistToSnap(child.blacklist); setTimeout(() => setSnapSyncing(false), 600); }} disabled={snapSyncing} className="w-full text-xs">{snapSyncing ? 'Syncing...' : 'Force sync blacklist'}</Button>
                </div>
              ) : snapStatus === 'unsupported' ? (
                <div className="text-xs" style={{ color: '#71717a' }}>Requires MetaMask Flask. <a href="https://metamask.io/flask/" target="_blank" rel="noopener noreferrer" style={{ color: '#e2e8f0' }} className="underline">Install Flask</a></div>
              ) : (
                <Button onClick={handleInstallSnap} disabled={snapInstalling} className="w-full text-xs">{snapInstalling ? 'Installing...' : 'Install Safety Snap'}</Button>
              )}
            </Card>

            <Card className="p-5 text-center">
              <p className="text-sm mb-3" style={{ color: '#71717a' }}>Kid wallet access is separate</p>
              <Link href="/kid/login"><Button variant="secondary" className="w-full">Kid login page →</Button></Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
