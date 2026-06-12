'use client';
import { useAppStore } from '../../store/useAppStore';
import { CONTRACTS } from '../../lib/contracts/addresses';
import type { Transaction } from '../../types';

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: 'green' | 'red' | 'amber' | 'slate' }) {
  const s: Record<string, React.CSSProperties> = {
    green: { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' },
    red: { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' },
    amber: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' },
    slate: { background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: '1px solid #27272a' },
  };
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s[color]}>{children}</span>;
}

function TxRow({ tx }: { tx: Transaction }) {
  return (
    <div className="flex items-center justify-between py-3.5 last:border-0" style={{ borderBottom: '1px solid #18181b' }}>
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-sm truncate" style={{ color: '#e2e8f0' }}>{tx.description}</div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] font-mono" style={{ color: '#52525b' }}>{tx.txHash ? `${tx.txHash.slice(0, 12)}...${tx.txHash.slice(-6)}` : 'pending'}</span>
          <span className="text-[10px]" style={{ color: '#52525b' }}>{new Date(tx.timestamp).toLocaleString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {tx.amount && <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{tx.amount} {tx.token}</span>}
        <Badge color={tx.status === 'success' ? 'green' : tx.status === 'pending' ? 'amber' : 'red'}>{tx.status}</Badge>
        {tx.explorerUrl && tx.txHash && <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px]" style={{ color: '#52525b' }}>View</a>}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { transactions, wallet } = useAppStore();
  const txs = wallet.smartAccountAddress ? transactions.filter(t => t.smartAccountAddress === wallet.smartAccountAddress) : transactions;
  const counts = { total: txs.length, success: txs.filter(t => t.status === 'success').length, blocked: txs.filter(t => t.status === 'failed').length };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>Transaction history</h1>
        <p className="text-sm mt-0.5" style={{ color: '#71717a' }}>All activity from the child's smart account</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Total', value: counts.total }, { label: 'Successful', value: counts.success }, { label: 'Blocked', value: counts.blocked }].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: '#111111', border: '1px solid #27272a' }}>
            <div className="text-2xl font-semibold" style={{ color: '#e2e8f0' }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: '#52525b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {wallet.smartAccountAddress && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: '#111111', border: '1px solid #27272a' }}>
          <span className="text-xs font-mono truncate" style={{ color: '#71717a' }}>{wallet.smartAccountAddress}</span>
          <a href={`${CONTRACTS.explorer}/address/${wallet.smartAccountAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:underline shrink-0 ml-4" style={{ color: '#e2e8f0' }}>View on Arbiscan</a>
        </div>
      )}

      <div className="rounded-xl px-5" style={{ background: '#111111', border: '1px solid #27272a' }}>
        {txs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: '#71717a' }}>No transactions yet.</p>
            <p className="text-xs mt-1" style={{ color: '#52525b' }}>Transactions will appear here once the child starts spending.</p>
          </div>
        ) : txs.map(tx => <TxRow key={tx.id} tx={tx} />)}
      </div>

      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#111111', border: '1px solid #27272a' }}>
        <div>
          <div className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Gasless transactions</div>
          <div className="text-xs mt-0.5" style={{ color: '#71717a' }}>All transactions are relayed free via 1Shot API on Arbitrum Sepolia.</div>
        </div>
        <Badge color="green">0 ETH gas</Badge>
      </div>
    </div>
  );
}
