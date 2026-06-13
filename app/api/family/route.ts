import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Family config store — file-based persistence.
 * Survives server sleep/wake on Render free tier.
 * Data is stored in /tmp/pocketguard-family.json (persists across restarts,
 * reset only on full redeploy).
 */

// Use /tmp on Render (writable), fall back to local .next folder for dev
const STORE_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/pocketguard-family.json'
  : path.join(process.cwd(), '.next', 'family-store.json');

function readStore(): Record<string, any> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch { /* corrupted file — start fresh */ }
  return {};
}

function writeStore(data: Record<string, any>): void {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[family-store] write failed:', e);
  }
}

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
    const store = readStore();

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
      writeStore(store);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'update') {
      const { parentAddress, familyPin, updates } = body;
      const key = makeKey(parentAddress, familyPin);
      if (!store[key]) return NextResponse.json({ error: 'Family not found' }, { status: 404 });
      store[key] = { ...store[key], ...updates, updatedAt: Date.now() };
      writeStore(store);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentAddress = searchParams.get('parentAddress');
  const familyPin = searchParams.get('pin');

  if (!parentAddress || !familyPin) {
    return NextResponse.json({ error: 'parentAddress and pin are required' }, { status: 400 });
  }

  const store = readStore();
  const key = makeKey(parentAddress, familyPin);
  const config = store[key];

  if (!config) {
    return NextResponse.json({
      error: 'No family found. Make sure the parent has opened their dashboard at least once after setup.',
    }, { status: 404 });
  }

  return NextResponse.json({ config });
}
