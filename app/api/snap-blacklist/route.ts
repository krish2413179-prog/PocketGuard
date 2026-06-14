import { NextResponse } from 'next/server';
import { readFamilyStore } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Default hardcoded betting/gambling addresses (mirrors snap/src/blacklist.ts)
const DEFAULT_BLACKLIST = [
  '0x4de23f3f0fb3318287378adbde030cf61714b2f3', // Polymarket
  '0xda7320ddebe7964ba029472e38e75c417a2a9448', // Shuffle Gaming
  '0x9999999999999999999999999999999999999999', // Generic betting
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
};

export async function GET() {
  // Aggregate blacklists from all family records stored in the persistent store
  const store = await readFamilyStore();
  const allBlacklisted: string[] = [];
  for (const key of Object.keys(store)) {
    const record = store[key];
    if (Array.isArray(record.blacklist)) {
      allBlacklisted.push(...record.blacklist.map((a: string) => a.toLowerCase()));
    }
  }

  const merged = [...new Set([...DEFAULT_BLACKLIST, ...allBlacklisted])];

  return NextResponse.json(
    { blacklist: merged, count: merged.length },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: Request) {
  // snap-blacklist POST is now a no-op; the blacklist is derived from the family store.
  // Kept for backwards compatibility with the Snap.
  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
