'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAppStore, type ApprovalRequest } from '../../store/useAppStore';
import { parseEther, formatEther, createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { CONTRACTS } from '../../lib/contracts/addresses';
import { relayTransaction } from '../../lib/oneshot/relayer';
import { installSnap, getSnapStatus, type SnapInstallStatus } from '../../lib/snap/install';

const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(CONTRACTS.rpc) });

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl ${className}`} style={{ background: '#111111', border: '1px solid #27272a' }}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#52525b' }}>{children}</div>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors" style={{ background: '#0f0f0f', border: '1px solid #27272a', color: '#e2e8f0' }} />;
}

export default function KidPage() {
  const { child, permissions, transactions, addTransaction, pennyMessages, addPennyMessage, pendingRequests, addPendingRequest, setPendingRequests, setTransactions, setPermissions } = useAppStore();
  const [balance, setBalance] = useState('0');
  const [ethPrice, setEthPrice] = useState(3000);

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const bal = await publicClient.getBalance({ address: addr as `0x${string}` });
      setBalance(parseFloat(formatEther(bal)).toFixed(4));
    } catch {
      setBalance('0');
    }
  }, []);
  const [spendAmount, setSpendAmount] = useState('');
  const [spendAddress, setSpendAddress] = useState('');
  const [spendToken, setSpendToken] = useState('ETH');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' | 'warn' } | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [pennyInput, setPennyInput] = useState('');
  const [pennyTyping, setPennyTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [snapStatus, setSnapStatus] = useState<SnapInstallStatus>('not_installed');
  const [snapInstalling, setSnapInstalling] = useState(false);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      .then(r => r.json()).then(d => { if (d.ethereum?.usd) setEthPrice(d.ethereum.usd); }).catch(() => {});
    getSnapStatus().then(setSnapStatus);
  }, []);

  useEffect(() => {
    if (child?.smartAccountAddress) {
      fetchBalance(child.smartAccountAddress);
    }
  }, [child?.smartAccountAddress, fetchBalance]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [pennyMessages, pennyTyping]);

  const handleInstallSnap = async () => { setSnapInstalling(true); try { await installSnap(); setSnapStatus('installed'); } catch (e: any) { console.error(e.message); } finally { setSnapInstalling(false); } };

  const handleSpend = async () => {
    setShowRequest(false);
    if (!child) { setNotice({ text: 'Wallet not configured. Ask your parents to set up your account.', type: 'error' }); return; }
    if (child.isPaused) { setNotice({ text: 'Your wallet is currently paused by your parents.', type: 'error' }); return; }
    const amt = parseFloat(spendAmount);
    if (isNaN(amt) || amt <= 0) { setNotice({ text: 'Please enter a valid amount.', type: 'error' }); return; }
    const target = spendAddress.trim().toLowerCase();
    if (target && child.blacklist.some(a => a.toLowerCase() === target)) {
      setNotice({ text: 'This address is blocked by your parents.', type: 'error' });
      addTransaction({ id: `tx_${Date.now()}`, txHash: '', explorerUrl: '', type: 'send', description: `Blocked: attempted transfer to blocked address`, amount: spendAmount, token: spendToken, status: 'failed', timestamp: Date.now(), smartAccountAddress: child.smartAccountAddress });
      return;
    }
    const amtUSD = amt * (spendToken === 'ETH' ? ethPrice : 1);
    if (amtUSD > child.dailyLimitUSD) { setNotice({ text: `This exceeds your daily limit of $${child.dailyLimitUSD}. You can request parent approval.`, type: 'warn' }); setShowRequest(true); return; }
    const isWhitelisted = !target || child.whitelist.some(a => a.toLowerCase() === target) || target === CONTRACTS.WETH.toLowerCase() || target === CONTRACTS.USDC.toLowerCase();
    if (!isWhitelisted) { setNotice({ text: 'This address is not on your approved list. You can request parent approval.', type: 'warn' }); setShowRequest(true); return; }
    setSubmitting(true); setNotice(null);
    try {
      const perm = permissions.find(p => !p.isRevoked && p.smartAccountAddress === child.smartAccountAddress);
      if (!perm) throw new Error('No active permission found. Ask your parents to renew your allowance.');
      const result = await relayTransaction({ to: spendAddress.trim() || CONTRACTS.WETH, data: '0x', value: parseEther(spendAmount).toString(), permissionContext: perm.permissionContext, smartAccountAddress: child.smartAccountAddress, permissionId: perm.permissionId });
      addTransaction({ id: `tx_${Date.now()}`, txHash: result.txHash, explorerUrl: result.explorerUrl, type: 'send', description: `Sent ${spendAmount} ${spendToken}`, amount: spendAmount, token: spendToken, status: 'success', timestamp: Date.now(), smartAccountAddress: child.smartAccountAddress });
      setNotice({ text: `Sent ${spendAmount} ${spendToken} — no gas fees paid.`, type: 'success' }); setSpendAmount(''); setSpendAddress('');
      if (child.smartAccountAddress) fetchBalance(child.smartAccountAddress);
    } catch (err: any) { setNotice({ text: err.message, type: 'error' }); } finally { setSubmitting(false); }
  };

  const handleRequestApproval = async () => {
    if (!child) return;
    const newRequest: ApprovalRequest = { id: `req_${Date.now()}`, to: spendAddress.trim() || CONTRACTS.WETH, amount: spendAmount, token: spendToken, status: 'pending', description: `Spend ${spendAmount} ${spendToken} at ${spendAddress.trim() ? spendAddress.trim().slice(0, 12) + '...' : 'address'}`, timestamp: Date.now() };
    addPendingRequest(newRequest);

    // Sync the new request directly to the server so the parent dashboard sees it
    try {
      const updatedRequests = [newRequest, ...pendingRequests];
      await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          parentAddress: child.parentAddress,
          familyPin: child.familyPin,
          updates: {
            pendingRequests: updatedRequests
          }
        })
      });
    } catch (err) {
      console.error('Failed to sync pending request to server:', err);
    }

    setNotice({ text: 'Approval request sent to your parents.', type: 'success' }); setShowRequest(false); setSpendAmount(''); setSpendAddress('');
  };

  // Poll family config from server to get updated request status/allowance from parent
  useEffect(() => {
    if (!child?.familyPin || !child?.parentAddress) return;

    const fetchFamilyConfig = async () => {
      try {
        const res = await fetch(`/api/family?parentAddress=${encodeURIComponent(child.parentAddress)}&pin=${encodeURIComponent(child.familyPin)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            if (data.config.pendingRequests) {
              setPendingRequests(data.config.pendingRequests);
            }
            if (data.config.transactions) {
              setTransactions(data.config.transactions);
            }
            if (data.config.permissions) {
              setPermissions(data.config.permissions);
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
  }, [child?.familyPin, child?.parentAddress, setPendingRequests, setTransactions, setPermissions]);

  const handlePennySend = async () => {
    if (!pennyInput.trim() || pennyTyping) return;
    const text = pennyInput; setPennyInput('');
    addPennyMessage({ id: `m_${Date.now()}`, role: 'user', content: text, timestamp: Date.now() });
    setPennyTyping(true);
    try {
      const res = await fetch('/api/penny', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, childName: child?.name || 'there', dailyLimit: child?.dailyLimitUSD || 3, balance: (parseFloat(balance) * ethPrice).toFixed(2), goal: child?.savingsGoalName || 'Savings goal' }) });
      const data = await res.json();
      addPennyMessage({ id: `m_${Date.now() + 1}`, role: 'assistant', content: data.reply, timestamp: Date.now() });
    } catch { addPennyMessage({ id: `m_${Date.now() + 1}`, role: 'assistant', content: "I'm having trouble connecting right now. Try again in a moment.", timestamp: Date.now() }); }
    finally { setPennyTyping(false); }
  };

  const childTxs = transactions.filter(t => child && t.smartAccountAddress === child.smartAccountAddress);
  const balanceUSD = (parseFloat(balance) * ethPrice).toFixed(2);
  const goalPct = child ? Math.min(100, (child.savingsProgressUSD / child.savingsGoalUSD) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      <header className="sticky top-0 z-10" style={{ background: '#111111', borderBottom: '1px solid #27272a' }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div>
            <span className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>{child ? `${child.name}'s wallet` : 'Kid wallet'}</span>
            {child?.isPaused && <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>Paused</span>}
          </div>
          <div className="flex items-center gap-3">
            {snapStatus === 'installed' ? (
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>Safety active</span>
            ) : snapStatus !== 'unsupported' ? (
              <button onClick={handleInstallSnap} disabled={snapInstalling} className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ color: '#a1a1aa', background: '#18181b', border: '1px solid #27272a' }}>{snapInstalling ? 'Installing...' : 'Install safety guard'}</button>
            ) : null}
            <Link href="/dashboard"><button className="text-xs font-medium" style={{ color: '#71717a' }}>Parent view</button></Link>
            <Link href="/"><button className="text-xs font-medium" style={{ color: '#52525b' }}>← Home</button></Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-6 grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-4">
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#52525b' }}>Balance</div>
            <div className="text-3xl font-semibold" style={{ color: '#e2e8f0' }}>${balanceUSD}</div>
            <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>{balance} ETH</div>
            {child && (
              <div className="mt-3 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid #18181b', color: '#71717a' }}>
                <span>Daily limit: <span className="font-semibold" style={{ color: '#e2e8f0' }}>${child.dailyLimitUSD}</span></span>
                <span>Weekly: <span className="font-semibold" style={{ color: '#e2e8f0' }}>${child.weeklyAllowanceUSD}</span></span>
              </div>
            )}
          </Card>

          {child && (
            <Card className="p-5">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{child.savingsGoalName}</div>
                <div className="text-xs" style={{ color: '#71717a' }}>${child.savingsProgressUSD.toFixed(2)} / ${child.savingsGoalUSD}</div>
              </div>
              <div className="progress-track h-2"><div className="progress-fill" style={{ width: `${goalPct}%` }} /></div>
              <div className="text-xs mt-1.5" style={{ color: '#52525b' }}>{goalPct.toFixed(0)}% of goal reached</div>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>Send</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount</Label><Input type="number" placeholder="0.001" value={spendAmount} onChange={e => setSpendAmount(e.target.value)} /></div>
                <div><Label>Token</Label><select value={spendToken} onChange={e => setSpendToken(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#0f0f0f', border: '1px solid #27272a', color: '#e2e8f0' }}><option value="ETH">ETH</option><option value="USDC">USDC</option></select></div>
              </div>
              <div><Label>Recipient address</Label><Input type="text" placeholder="0x..." value={spendAddress} onChange={e => setSpendAddress(e.target.value)} /></div>
              {notice && (
                <div className="rounded-lg px-4 py-3 text-sm" style={notice.type === 'success' ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' } : notice.type === 'error' ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' } : { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>{notice.text}</div>
              )}
              <div className="flex gap-2">
                <button onClick={handleSpend} disabled={submitting || !spendAmount} className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: '#e2e8f0', color: '#0a0a0a' }}>{submitting ? 'Processing...' : 'Send (gasless)'}</button>
                {showRequest && <button onClick={handleRequestApproval} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#18181b', color: '#e2e8f0', border: '1px solid #27272a' }}>Request approval</button>}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>My requests</h3>
            {pendingRequests.length === 0 ? <p className="text-sm text-center py-2" style={{ color: '#52525b' }}>No requests yet.</p> : (
              <div className="space-y-2">{pendingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid #18181b' }}>
                  <div><div className="text-sm" style={{ color: '#e2e8f0' }}>{req.description}</div><div className="text-[10px] mt-0.5" style={{ color: '#52525b' }}>{new Date(req.timestamp).toLocaleTimeString()}</div></div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={req.status === 'approved' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' } : req.status === 'rejected' ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' } : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>{req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Waiting'}</span>
                </div>
              ))}</div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>Transaction history</h3>
            {childTxs.length === 0 ? <p className="text-sm text-center py-2" style={{ color: '#52525b' }}>No transactions yet.</p> : (
              <div className="space-y-2">{childTxs.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid #18181b' }}>
                  <div><div className="text-sm" style={{ color: '#e2e8f0' }}>{tx.description}</div><div className="text-[10px] mt-0.5" style={{ color: '#52525b' }}>{new Date(tx.timestamp).toLocaleDateString()}</div></div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={tx.status === 'success' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{tx.status === 'success' ? 'Sent' : 'Blocked'}</span>
                </div>
              ))}</div>
            )}
          </Card>
        </div>

        <div className="flex flex-col">
          <div className="flex flex-col rounded-xl h-[580px]" style={{ background: '#111111', border: '1px solid #27272a' }}>
            <div className="p-4" style={{ borderBottom: '1px solid #18181b' }}>
              <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>Penny</div>
              <div className="text-xs" style={{ color: '#52525b' }}>Money coach — ask me anything</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {pennyMessages.length === 0 ? (
                <p className="text-xs text-center pt-4" style={{ color: '#52525b' }}>Ask me about saving money, your balance, or why a transaction was blocked.</p>
              ) : pennyMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed" style={msg.role === 'user' ? { background: '#e2e8f0', color: '#0a0a0a' } : { background: '#18181b', color: '#a1a1aa' }}>{msg.content}</div>
                </div>
              ))}
              {pennyTyping && <div className="flex justify-start"><div className="px-3 py-2.5 rounded-xl flex gap-1 items-center" style={{ background: '#18181b' }}><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 flex gap-2" style={{ borderTop: '1px solid #18181b' }}>
              <input type="text" placeholder="Ask a question..." value={pennyInput} onChange={e => setPennyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePennySend()} className="flex-1 rounded-lg px-3 py-2 text-xs outline-none" style={{ background: '#0a0a0a', border: '1px solid #27272a', color: '#e2e8f0' }} />
              <button onClick={handlePennySend} disabled={!pennyInput.trim() || pennyTyping} className="px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40" style={{ background: '#e2e8f0', color: '#0a0a0a' }}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
