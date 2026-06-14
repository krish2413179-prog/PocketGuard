import { NextRequest, NextResponse } from 'next/server';
import { readFamilyStore, writeFamilyStore } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function makeKey(parentAddress: string, pin: string): string {
  const combined = `${parentAddress.toLowerCase()}_${pin}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = await readFamilyStore();

    if (body.action === 'save') {
      const { parentAddress, familyPin, childConfig, permissions, transactions, pendingRequests } = body;
      if (!parentAddress || !familyPin || !childConfig) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      const key = makeKey(parentAddress, familyPin);
      store[key] = {
        ...childConfig,
        permissions: permissions || store[key]?.permissions || [],
        transactions: transactions || store[key]?.transactions || [],
        pendingRequests: pendingRequests || store[key]?.pendingRequests || [],
        savedAt: Date.now()
      };
      await writeFamilyStore(store);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'update') {
      const { parentAddress, familyPin, updates } = body;
      const key = makeKey(parentAddress, familyPin);
      if (!store[key]) return NextResponse.json({ error: 'Family not found' }, { status: 404 });
      store[key] = { ...store[key], ...updates, updatedAt: Date.now() };
      await writeFamilyStore(store);
      return NextResponse.json({ success: true });
    }

    // Child uses this to safely append a new approval request server-side.
    if (body.action === 'append-request') {
      const { parentAddress, familyPin, request } = body;
      if (!parentAddress || !familyPin || !request) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      const key = makeKey(parentAddress, familyPin);
      if (!store[key]) return NextResponse.json({ error: 'Family not found' }, { status: 404 });
      const existing: any[] = store[key].pendingRequests || [];
      // Avoid duplicates
      if (!existing.find((r: any) => r.id === request.id)) {
        store[key].pendingRequests = [request, ...existing];
        store[key].updatedAt = Date.now();
        await writeFamilyStore(store);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentAddress = searchParams.get('parentAddress');
  const familyPin = searchParams.get('pin');

  if (!parentAddress || !familyPin) {
    return NextResponse.json({ error: 'parentAddress and pin are required' }, { status: 400 });
  }

  const store = await readFamilyStore();
  const key = makeKey(parentAddress, familyPin);
  const config = store[key];

  if (!config) {
    return NextResponse.json({
      error: 'No family found. Make sure the parent has opened their dashboard at least once after setup.',
    }, { status: 404 });
  }

  return NextResponse.json({ config });
}
