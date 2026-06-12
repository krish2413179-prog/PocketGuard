import { NextRequest, NextResponse } from 'next/server';
import { relayTransaction } from '../../../lib/oneshot/relayer';
import type { Transaction } from '../../../types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory store for demo (in production: use a DB)
const txStore: Transaction[] = [];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get('account');
  const filtered = account ? txStore.filter((t) => t.smartAccountAddress === account) : txStore;
  return NextResponse.json({ transactions: filtered.slice(0, 50) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === 'relay') {
    const { to, data, value, permissionContext, smartAccountAddress, permissionId, type, description, amount, token } = body;

    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const pendingTx: Transaction = {
      id: txId, txHash: '', explorerUrl: '',
      type: type || 'other', description: description || 'Transaction',
      amount, token, status: 'pending',
      timestamp: Date.now(), smartAccountAddress, permissionId,
    };
    txStore.unshift(pendingTx);

    try {
      const result = await relayTransaction({ to, data, value, permissionContext, smartAccountAddress, permissionId });
      pendingTx.txHash = result.txHash;
      pendingTx.explorerUrl = result.explorerUrl;
      pendingTx.status = 'success';
      return NextResponse.json({ txHash: result.txHash, explorerUrl: result.explorerUrl, id: txId });
    } catch (err: any) {
      pendingTx.status = 'failed';
      return NextResponse.json({ error: err.message || 'Relay failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
